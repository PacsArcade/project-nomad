#!/bin/sh
# send-to-convertx.sh - hand a file to ConvertX.
#
# Two callers:
#   1. By hand from File Browser's shell panel (needs curl; the pinned
#      filebrowser v2.63.23 image ships only busybox wget, so from inside
#      that container this script cannot run - run it from another host).
#   2. copyparty's on-upload hook (contrib/file-bridge/on-upload.sh), which
#      passes the absolute path of the file that just landed.
#
# Usage: send-to-convertx.sh FILE EXT,CONVERTER
#   EXT,CONVERTER is ConvertX's convert_to pair, for example png,vips or
#   pdf,pandoc. ConvertX's UI shows the converter name next to each target
#   format.
#
# ConvertX must run with ALLOW_UNAUTHENTICATED=true (it signs a cookie for a
# shared unauthenticated user on GET /) and HTTP_ALLOWED=true (its cookies
# are marked secure otherwise, and curl will not send them over plain http).
# The seeded ConvertX catalog entry keeps accounts on, so this hand-off
# needs that one-time flip via Manage > Edit; that coupling is deliberate.
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

if ! command -v curl >/dev/null 2>&1; then
  echo "send-to-convertx: needs curl (cookie jar); see the header comment" >&2
  exit 1
fi

file="$1"
pair="$2"

if [ ! -f "$file" ]; then
  echo "send-to-convertx: no such file: $file" >&2
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

out="$tmpdir/answer.tar"
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
