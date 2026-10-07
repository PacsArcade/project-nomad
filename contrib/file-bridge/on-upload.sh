#!/bin/sh
# on-upload.sh - copyparty xau hook: the no-click bridge entry point.
#
# copyparty runs this after every upload (the volume carries the volflag
# `xau: f,c1,t120,/hooks/on-upload.sh`: fork the hook so the upload never
# blocks on it, one at a time, 120 s timeout). copyparty passes the
# absolute path of the file that just landed as the only argument.
#
# What happens to a landed file:
#   .pdf                 -> Stirling compress-pdf, result NAME-stirling.pdf
#   .docx .odt .rtf .md  -> ConvertX to PDF (pandoc), result beside it
#   .png .jpg .jpeg .heic .tif .tiff .bmp -> ConvertX to WebP (vips)
#   .wav .ogg .flac .m4a -> ConvertX to MP3 (ffmpeg)
#   anything else        -> nothing (the bridge only moves files that have
#                           a declared target; everything else just sits in
#                           the listing)
#
# Every hand-off goes through the two fixed scripts beside this one; they
# carry the stdin filename fix, the sanitized-name fix, the tar-member
# validation, and the visible failure marker (NAME.bridge-failed in the
# same folder) when a hand-off fails. The hook's own outputs and marker
# files are never re-processed, so there is no loop.
#
# STIRLING_URL and CONVERTX_URL come from the container environment, set by
# the catalog entry to the fixed service names on the NOMAD network. The
# ConvertX hand-off additionally needs ConvertX running with
# ALLOW_UNAUTHENTICATED=true (see the send-to-convertx.sh header).

set -eu

here=$(dirname "$0")
file="${1:-}"

[ -n "$file" ] && [ -f "$file" ] || exit 0

base=$(basename "$file")

# Never re-process hook outputs or markers.
case "$base" in
  *-stirling.pdf|*.bridge-failed) exit 0 ;;
esac

lower=$(printf '%s' "$base" | tr 'A-Z' 'a-z')

run_bridge() {
  script="$1"
  shift
  if [ -x "$here/$script" ]; then
    "$here/$script" "$file" "$@" || true
  else
    printf '%s\n' "hand-off failed: $script is missing from the hooks folder" > "$file.bridge-failed" 2>/dev/null || true
  fi
}

case "$lower" in
  *.pdf)
    run_bridge send-to-stirling.sh
    ;;
  *.docx|*.odt|*.rtf|*.md)
    run_bridge send-to-convertx.sh "pdf,pandoc"
    ;;
  *.png|*.jpg|*.jpeg|*.heic|*.tif|*.tiff|*.bmp)
    run_bridge send-to-convertx.sh "webp,vips"
    ;;
  *.wav|*.ogg|*.flac|*.m4a)
    run_bridge send-to-convertx.sh "mp3,ffmpeg"
    ;;
  *)
    # No declared target: the file just sits in the listing.
    exit 0
    ;;
esac
