#!/bin/sh
# send-to-stirling.sh - hand a file to Stirling PDF.
#
# Two callers:
#   1. File Browser's shell panel (the < > button in the header). The shell
#      opens in the folder you are browsing, so pass the file name as it
#      appears in the listing:
#        /bridge/send-to-stirling.sh "my scan.pdf"
#        /bridge/send-to-stirling.sh "my scan.pdf" 3
#   2. copyparty's on-upload hook (contrib/file-bridge/on-upload.sh), which
#      passes the absolute path of the file that just landed.
#
# The optional second argument is Stirling's optimize level (1-9, default 2;
# higher means smaller but lower quality).
#
# What it does: posts the file to Stirling's compress-pdf API and saves the
# result next to the original as NAME-stirling.pdf, then prints the link to
# Stirling's compress tool page for follow-up work.
#
# Filenames: the file rides to Stirling on stdin under the FIXED name
# upload.pdf (curl -F "fileInput=@-;filename=upload.pdf" < file). A comma or
# semicolon in the real name used to break curl's -F parser (curl exit 26,
# "Budget, final.pdf" read as two files); a quote could break the multipart
# header. The stdin shape closes both, so any legal filename uploads clean.
#
# Failure visibility: when the hand-off fails, a marker file
# NAME.pdf.bridge-failed is written beside the upload, so the failure is
# visible in the file listing. A later success removes the marker.
#
# Config: STIRLING_URL env var, required; the script exits with an error
# when it is not set. Point it at your Stirling, for example
# http://stirling-host:8400. No login: the catalog ships Stirling
# with SECURITY_ENABLELOGIN=false. If you turn Stirling's login on, this
# script stops working; that is the honest limit of the API path.
#
# Deps: curl if present, else busybox wget (the filebrowser container image
# ships only busybox wget, so the multipart body is built by hand).

set -eu

if [ -z "${STIRLING_URL:-}" ]; then
  echo "send-to-stirling: STIRLING_URL is not set; point it at your Stirling PDF, for example http://stirling-host:8400" >&2
  exit 2
fi
ENDPOINT="$STIRLING_URL/api/v1/misc/compress-pdf"
TOOL_PAGE="$STIRLING_URL/compress-pdf"

if [ $# -lt 1 ]; then
  echo "usage: send-to-stirling.sh FILE [optimize-level 1-9]" >&2
  exit 2
fi

file="$1"
level="${2:-2}"

if [ ! -f "$file" ]; then
  echo "send-to-stirling: no such file: $file" >&2
  exit 1
fi

base=$(basename "$file")
stem=${base%.*}
dir=$(dirname "$file")
out="$dir/$stem-stirling.pdf"
marker="$file.bridge-failed"

# The visible failure marker: one line of plain words, readable in any
# listing. Cleared by the next successful hand-off.
fail() {
  reason="$1"
  echo "send-to-stirling: $reason" >&2
  printf '%s\n' "hand-off to Stirling failed: $reason" > "$marker" 2>/dev/null || true
  exit 1
}

if [ -e "$out" ]; then
  fail "$out already exists, refusing to overwrite"
fi

# The file goes on stdin under a fixed name, so commas, semicolons and
# quotes in the real name can never reach the multipart parser.
if command -v curl >/dev/null 2>&1; then
  code=$(curl -s -o "$out" -w '%{http_code}' \
    -F "fileInput=@-;filename=upload.pdf;type=application/pdf" \
    -F "optimizeLevel=$level" \
    "$ENDPOINT" < "$file") || { rm -f "$out"; fail "cannot reach Stirling at $STIRLING_URL"; }
  if [ "$code" != "200" ]; then
    rm -f "$out"
    fail "Stirling answered HTTP $code"
  fi
else
  boundary="----wanderpac-bridge-$$"
  body=$(mktemp)
  {
    printf '%s\r\n' "--$boundary"
    printf 'Content-Disposition: form-data; name="fileInput"; filename="upload.pdf"\r\n'
    printf 'Content-Type: application/pdf\r\n'
    printf '\r\n'
    cat "$file"
    printf '\r\n'
    printf '%s\r\n' "--$boundary"
    printf 'Content-Disposition: form-data; name="optimizeLevel"\r\n'
    printf '\r\n'
    printf '%s\r\n' "$level"
    printf '%s\r\n' "--$boundary--"
  } > "$body"
  if ! wget -q -O "$out" \
    --header="Content-Type: multipart/form-data; boundary=$boundary" \
    --post-file="$body" \
    "$ENDPOINT"; then
    rm -f "$body" "$out"
    fail "Stirling refused the file (or is unreachable at $STIRLING_URL)"
  fi
  rm -f "$body"
fi

# Stirling answers errors with HTML or JSON; a real answer starts with %PDF.
magic=$(head -c 4 "$out" || true)
if [ "$magic" != "%PDF" ]; then
  rm -f "$out"
  fail "answer was not a PDF; Stirling rejected the file"
fi

rm -f "$marker"
echo "sent: $base"
echo "saved: $out (beside the original)"
echo "open Stirling's compress tool: $TOOL_PAGE"
