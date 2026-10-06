#!/usr/bin/env bash
# patch-route-html.sh, inject the arcade.css link into every Stirling v3
# route page.
#
# Why this exists: Stirling v3 ships one prerendered HTML file per route
# (static/merge.html, static/crop.html, ...) inside /app/app.jar. A custom
# customFiles/static/index.html only themes the root page; every tool route
# keeps serving its bundled page until a patched copy exists in
# customFiles/static/. This script extracts the originals from the jar of
# the RUNNING container (so the hashed asset references always match the
# deployed version), adds one line before </head>:
#     <link rel="stylesheet" href="/arcade.css">
# and writes the results into /customFiles/static/.
#
# Usage:
#   ./patch-route-html.sh [container-name]     default container: stirling-pdf
#
# Run it after every Stirling upgrade, after arcade.css is in place, then
# restart the container (Stirling caches transformed pages in memory, so
# routes visited before the patch keep serving the old copy until restart).
set -euo pipefail

CONTAINER="${1:-stirling-pdf}"

if command -v podman >/dev/null 2>&1; then
  RUNTIME=podman
elif command -v docker >/dev/null 2>&1; then
  RUNTIME=docker
else
  echo "error: neither podman nor docker found" >&2
  exit 1
fi

"$RUNTIME" exec "$CONTAINER" python3 - <<'PYEOF'
import zipfile, os
z = zipfile.ZipFile('/app/app.jar')
link = '    <link rel="stylesheet" href="/arcade.css">\n'
count = 0
skipped = 0
for n in z.namelist():
    if not (n.startswith('static/') and n.endswith('.html')):
        continue
    if n == 'static/index.html':
        continue
    data = z.read(n).decode('utf-8')
    if 'arcade.css' in data:
        skipped += 1
        continue
    if '</head>' not in data:
        print('warning: no </head> in', n)
        continue
    data = data.replace('</head>', link + '</head>', 1)
    dest = os.path.join('/customFiles', n)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w') as f:
        f.write(data)
    count += 1
print('patched %d route pages, %d already carried the link' % (count, skipped))
PYEOF

echo "done. Now restart the container so its page cache picks up the patched files:"
echo "  $RUNTIME restart $CONTAINER"
