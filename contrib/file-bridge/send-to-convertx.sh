#!/bin/sh
# send-to-convertx.sh - hand a file from File Browser to ConvertX.
#
# STATUS: EXPERIMENTAL, NOT PROVEN. ConvertX v0.19.0 has no public API; this
# script drives the same session-cookie form flow its web UI uses (verified
# by reading ConvertX source at v0.19.0, not by a live run). It needs curl
# with a cookie jar; the pinned filebrowser v2.63.23 image ships only busybox
# wget, so this script cannot run inside the stock File Browser container
# today. It is shipped for adopters who run it from another host, and as the
# honest record of what the ConvertX hand-off takes. Until then ConvertX is
# served by move 3 alone: open the page, upload through its UI.
#
# Usage: send-to-convertx.sh FILE EXT,CONVERTER
#   EXT,CONVERTER is ConvertX's convert_to pair, for example png,vips or
#   pdf,pandoc. ConvertX's UI shows the converter name next to each target
#   format.
#
# ConvertX must run with ALLOW_UNAUTHENTICATED=true (it signs a cookie for a
# shared unauthenticated user on GET /) and HTTP_ALLOWED=true (its cookies
# are marked secure otherwise, and curl will not send them over plain http).
#
# Flow (from ConvertX v0.19.0 source):
#   GET /            sets the auth and jobId cookies and creates a job
#   POST /upload     multipart field "file"
#   POST /convert    fields convert_to="EXT,CONVERTER", file_names='["FILE"]'
#                    answers 302 to /results/JOBID while converting in background
#   GET /archive/JOBID   tar of every output file once the job completes
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
jar=$(mktemp)
trap 'rm -f "$jar"' EXIT

if ! curl -s -c "$jar" -o /dev/null "$CONVERTX_URL/"; then
  echo "send-to-convertx: cannot reach ConvertX at $CONVERTX_URL" >&2
  exit 1
fi

curl -s -b "$jar" -c "$jar" -o /dev/null -F "file=@$file" "$CONVERTX_URL/upload"

# The 302 target carries the job id.
location=$(curl -s -b "$jar" -c "$jar" -o /dev/null -w '%{redirect_url}' \
  -F "convert_to=$pair" \
  -F "file_names=[\"$base\"]" \
  "$CONVERTX_URL/convert")

job=${location##*/}
if [ -z "$job" ] || [ "$job" = "$location" ]; then
  echo "send-to-convertx: ConvertX did not start a job (check EXT,CONVERTER)" >&2
  exit 1
fi

out="$base.convertx.tar"
tries=0
while [ $tries -lt 30 ]; do
  if curl -s -b "$jar" -o "$out" "$CONVERTX_URL/archive/$job" && [ -s "$out" ]; then
    if tar tf "$out" >/dev/null 2>&1; then
      tar xf "$out"
      rm -f "$out"
      echo "sent: $base"
      echo "saved: converted file(s) unpacked into this folder"
      echo "open the job page: $CONVERTX_URL/results/$job"
      exit 0
    fi
  fi
  tries=$((tries + 1))
  sleep 2
done

echo "send-to-convertx: job $job did not finish in time; check $CONVERTX_URL/results/$job" >&2
rm -f "$out"
exit 1
