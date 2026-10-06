#!/bin/sh
# send-to-convertx.sh - hand a file to ConvertX.
#
# Two callers:
#   1. By hand from File Browser's shell panel (needs curl or python3; the
#      pinned filebrowser v2.63.23 image ships only busybox wget, so from
#      inside that container this script cannot run - run it from another
#      host).
#   2. copyparty's on-upload hook (contrib/file-bridge/on-upload.sh), which
#      passes the absolute path of the file that just landed. The copyparty
#      container ships python3, which this script uses when curl is absent.
#
# Usage: send-to-convertx.sh FILE EXT,CONVERTER
#   EXT,CONVERTER is ConvertX's convert_to pair, for example png,vips or
#   pdf,pandoc. ConvertX's UI shows the converter name next to each target
#   format.
#
# ConvertX must run with ALLOW_UNAUTHENTICATED=true (it signs a cookie for a
# shared unauthenticated user on GET /) and HTTP_ALLOWED=true (its cookies
# are marked secure otherwise, and neither curl nor python3 will send them
# over plain http). The seeded ConvertX catalog entry keeps accounts on, so
# this hand-off needs that one-time flip via Manage > Edit; that coupling is
# deliberate.
#
# Flow (from ConvertX v0.19.0 source):
#   GET /            sets the auth and jobId cookies and creates a job
#   POST /upload     multipart field "file"
#   POST /convert    fields convert_to="EXT,CONVERTER", file_names='["FILE"]'
#                    answers 302 to /results/JOBID while converting in background
#   GET /archive/JOBID   tar of every output file once the job completes
#
# Filenames: the file rides to ConvertX on stdin (curl -F "file=@-" < file)
# under a SANITIZED copy of its real name: quotes, backslashes, commas,
# semicolons and control characters are stripped. A comma or semicolon in
# the raw name breaks curl's -F parser, and a quote or backslash injected
# into the JSON file_names field breaks or bends it; the sanitized name is
# used in both places, so neither can happen.
#
# Archive safety: the answer tar is listed BEFORE extraction into a mktemp
# dir, and any member with a '..' path element or a leading slash is
# rejected. Only regular files then move into the folder beside the
# original; a compromised or buggy ConvertX answer cannot write outside it.
#
# Failure visibility: when the hand-off fails, a marker file
# NAME.bridge-failed is written beside the upload, so the failure is
# visible in the file listing. A later success removes the marker.
#
# Config: CONVERTX_URL env var, required; the script exits with an error
# when it is not set. Point it at your ConvertX, for example
# http://convertx-host:8510 (the catalog port for ConvertX).

set -eu

if [ -z "${CONVERTX_URL:-}" ]; then
  echo "send-to-convertx: CONVERTX_URL is not set; point it at your ConvertX, for example http://convertx-host:8510" >&2
  exit 2
fi

if [ $# -lt 2 ]; then
  echo "usage: send-to-convertx.sh FILE EXT,CONVERTER   (example: photo.heic png,vips)" >&2
  exit 2
fi

file="$1"
pair="$2"

if [ ! -f "$file" ]; then
  echo "send-to-convertx: no such file: $file" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "send-to-convertx: needs curl or python3 (cookie jar); see the header comment" >&2
  exit 1
fi

base=$(basename "$file")
dir=$(dirname "$file")
marker="$file.bridge-failed"

# The name ConvertX sees: real enough to read, stripped of every character
# that could bend curl's -F parser or the JSON file_names field.
safe_base=$(printf '%s' "$base" | tr -d '"\\,;' | tr -d '\000-\037')
[ -n "$safe_base" ] || safe_base="upload.bin"

fail() {
  reason="$1"
  echo "send-to-convertx: $reason" >&2
  printf '%s\n' "hand-off to ConvertX failed: $reason" > "$marker" 2>/dev/null || true
  exit 1
}

jar=$(mktemp)
tmpdir=$(mktemp -d)
trap 'rm -rf "$jar" "$tmpdir"' EXIT

out="$tmpdir/answer.tar"

if command -v curl >/dev/null 2>&1; then
  curl -s -c "$jar" -o /dev/null "$CONVERTX_URL/" || fail "cannot reach ConvertX at $CONVERTX_URL"

  curl -s -b "$jar" -c "$jar" -o /dev/null \
    -F "file=@-;filename=$safe_base" \
    "$CONVERTX_URL/upload" < "$file" || fail "upload to ConvertX failed"

  # The 302 target carries the job id.
  location=$(curl -s -b "$jar" -c "$jar" -o /dev/null -w '%{redirect_url}' \
    -F "convert_to=$pair" \
    -F "file_names=[\"$safe_base\"]" \
    "$CONVERTX_URL/convert")

  job=${location##*/}
  if [ -z "$job" ] || [ "$job" = "$location" ]; then
    fail "ConvertX did not start a job (check EXT,CONVERTER)"
  fi

  tries=0
  ready=0
  while [ $tries -lt 30 ]; do
    if curl -s -b "$jar" -o "$out" "$CONVERTX_URL/archive/$job" && [ -s "$out" ]; then
      if tar tf "$out" >/dev/null 2>&1; then
        ready=1
        break
      fi
    fi
    tries=$((tries + 1))
    sleep 2
  done

  if [ "$ready" != "1" ]; then
    fail "job $job did not finish in time; check $CONVERTX_URL/results/$job"
  fi
else
  # No curl (the copyparty container ships python3 but no curl): the same
  # cookie-session flow in python, writing the answer tar for the shell to
  # validate below. Reads CONVERTX_URL from the environment.
  job=$(python3 - "$file" "$safe_base" "$pair" "$out" <<'PYEOF'
import http.cookiejar
import sys
import time
import urllib.error
import urllib.request

file_path, safe_base, pair, out_path = sys.argv[1:5]
base_url = __import__("os").environ["CONVERTX_URL"].rstrip("/")

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def multipart(fields, file_field, file_name, file_bytes):
    boundary = "----wanderpac-bridge-py"
    body = b""
    for key, val in fields:
        body += ("--%s\r\n" % boundary).encode()
        body += ('Content-Disposition: form-data; name="%s"\r\n\r\n' % key).encode()
        body += (str(val) + "\r\n").encode()
    body += ("--%s\r\n" % boundary).encode()
    body += (
        'Content-Disposition: form-data; name="%s"; filename="%s"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n" % (file_field, file_name)
    ).encode()
    body += file_bytes + b"\r\n"
    body += ("--%s--\r\n" % boundary).encode()
    return body, "multipart/form-data; boundary=%s" % boundary

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener_noredirect = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(jar), NoRedirect()
)

try:
    opener.open(base_url + "/", timeout=30).read()
except Exception as exc:
    sys.stderr.write("send-to-convertx: cannot reach ConvertX: %s\n" % exc)
    sys.exit(1)

with open(file_path, "rb") as fh:
    data = fh.read()
body, ctype = multipart([], "file", safe_base, data)
req = urllib.request.Request(
    base_url + "/upload", data=body, headers={"Content-Type": ctype}
)
try:
    opener.open(req, timeout=300).read()
except Exception as exc:
    sys.stderr.write("send-to-convertx: upload to ConvertX failed: %s\n" % exc)
    sys.exit(1)

# /convert takes only form fields, no file part.
boundary = "----wanderpac-bridge-py"
body = b""
for key, val in [("convert_to", pair), ("file_names", '["%s"]' % safe_base)]:
    body += ("--%s\r\n" % boundary).encode()
    body += ('Content-Disposition: form-data; name="%s"\r\n\r\n' % key).encode()
    body += (str(val) + "\r\n").encode()
body += ("--%s--\r\n" % boundary).encode()
req = urllib.request.Request(
    base_url + "/convert", data=body, headers={"Content-Type": ctype}
)
try:
    opener_noredirect.open(req, timeout=60)
    sys.stderr.write("send-to-convertx: ConvertX did not start a job\n")
    sys.exit(1)
except urllib.error.HTTPError as exc:
    if exc.code not in (301, 302, 303):
        sys.stderr.write("send-to-convertx: /convert answered HTTP %s\n" % exc.code)
        sys.exit(1)
    location = exc.headers.get("Location", "")

job = location.rstrip("/").rsplit("/", 1)[-1]
if not job:
    sys.stderr.write("send-to-convertx: ConvertX did not start a job\n")
    sys.exit(1)

import tarfile

for _ in range(30):
    try:
        reply = opener.open(base_url + "/archive/" + job, timeout=60)
        blob = reply.read()
        if blob:
            with open(out_path, "wb") as fh:
                fh.write(blob)
            try:
                with tarfile.open(out_path):
                    print(job)
                    sys.exit(0)
            except tarfile.TarError:
                pass
    except Exception:
        pass
    time.sleep(2)

sys.stderr.write(
    "send-to-convertx: job %s did not finish in time\n" % job
)
sys.exit(1)
PYEOF
  ) || fail "the ConvertX hand-off failed (see above)"
fi

# Validate every member before anything is extracted: no '..', no absolute
# paths, nothing that could escape the mktemp dir.
tar tf "$out" > "$tmpdir/members"
bad=0
while IFS= read -r member; do
  case "$member" in
    /*|../*|*/../*|*/..|..)
      echo "send-to-convertx: refusing unsafe tar member: $member" >&2
      bad=1
      ;;
  esac
done < "$tmpdir/members"
if [ "$bad" = "1" ]; then
  fail "archive from ConvertX held unsafe paths; nothing was extracted"
fi

mkdir "$tmpdir/x"
tar xf "$out" -C "$tmpdir/x" || fail "could not extract the ConvertX archive"

# Move only regular files, top level of the archive, into the folder beside
# the original. Refuse to overwrite anything already there.
moved=0
for produced in "$tmpdir/x"/*; do
  if [ -f "$produced" ]; then
    name=$(basename "$produced")
    if [ -e "$dir/$name" ]; then
      echo "send-to-convertx: $name already exists beside $base; get it from $CONVERTX_URL/results/$job instead" >&2
      continue
    fi
    mv "$produced" "$dir/$name"
    moved=$((moved + 1))
    echo "saved: $name (beside the original)"
  fi
done

if [ "$moved" = "0" ]; then
  fail "the ConvertX archive held no files to keep"
fi

rm -f "$marker"
echo "sent: $base"
echo "open the job page: $CONVERTX_URL/results/$job"
