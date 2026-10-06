#!/bin/sh
# send-to-stirling.sh - hand a file from File Browser to Stirling PDF.
#
# Run from File Browser's shell panel (the < > button in the header). The
# shell opens in the folder you are browsing, so pass the file name as it
# appears in the listing:
#
#   /bridge/send-to-stirling.sh "my scan.pdf"
#   /bridge/send-to-stirling.sh "my scan.pdf" 3
#
# The optional second argument is Stirling's optimize level (1-9, default 2;
# higher means smaller but lower quality).
#
# What it does: posts the file to Stirling's compress-pdf API and saves the
# result next to the original as NAME-stirling.pdf, then prints the link to
# Stirling's compress tool page for follow-up work.
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
out="$stem-stirling.pdf"

if [ -e "$out" ]; then
  echo "send-to-stirling: $out already exists, refusing to overwrite" >&2
  exit 1
fi

# A double quote in the file name would break the multipart header.
safe_base=$(printf '%s' "$base" | tr -d '"')

if command -v curl >/dev/null 2>&1; then
  code=$(curl -s -o "$out" -w '%{http_code}' \
    -F "fileInput=@$file;type=application/pdf" \
    -F "optimizeLevel=$level" \
    "$ENDPOINT") || { echo "send-to-stirling: cannot reach Stirling at $STIRLING_URL" >&2; rm -f "$out"; exit 1; }
  if [ "$code" != "200" ]; then
    echo "send-to-stirling: Stirling answered HTTP $code" >&2
    rm -f "$out"
    exit 1
  fi
else
  boundary="----wanderpac-bridge-$$"
  body=$(mktemp)
  {
    printf '%s\r\n' "--$boundary"
    printf 'Content-Disposition: form-data; name="fileInput"; filename="%s"\r\n' "$safe_base"
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
    echo "send-to-stirling: Stirling refused the file (or is unreachable at $STIRLING_URL)" >&2
    exit 1
  fi
  rm -f "$body"
fi

# Stirling answers errors with HTML or JSON; a real answer starts with %PDF.
magic=$(head -c 4 "$out" || true)
if [ "$magic" != "%PDF" ]; then
  echo "send-to-stirling: answer was not a PDF; Stirling rejected the file" >&2
  rm -f "$out"
  exit 1
fi

echo "sent: $base"
echo "saved: $out (in this folder)"
echo "open Stirling's compress tool: $TOOL_PAGE"
