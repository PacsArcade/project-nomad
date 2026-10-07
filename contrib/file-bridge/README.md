# contrib/file-bridge: File Browser hands files to the working apps

The WanderPac bridge pattern in one folder: File Browser is where the files
live, so it is where the hand-off starts. These scripts run inside the File
Browser container from its shell panel (the `< >` button in the header) and
push the file you name to the app that works on it.

## What File Browser v2.63.23 actually supports

Verified by reading upstream source at the v2.63.23 tag (the pinned image):

- The interactive shell (header `< >` button, websocket `/api/command`) runs
  a typed command with the working directory set to the folder you are
  browsing. It does NOT receive the selected file as an argument or env var;
  you type the file name yourself. There is no right-click "run command on
  this file" in v2.
- The command must be allowlisted per user:
  Settings > User Management > edit the user > Commands. The allowlist entry
  is the command's first token, so allowlist the full script path, for
  example `/bridge/send-to-stirling.sh`.
- The user also needs the Execute permission (the seeded admin has it).
- Command execution is DISABLED by default since v2.33.8 (upstream did this
  for security, see their issue 5199). The catalog entry sets
  `FB_DISABLE_EXEC=false` to turn it on. The exposure is bounded: only
  allowlisted command paths run, the allowlist is per user, and the box is a
  single-user offline appliance. Do not allowlist a bare shell (`sh`) unless
  you accept that it is full remote command execution for that user.
- The hook runner (before/after copy, rename, upload, delete, save) is a
  separate feature with its own `$FILE`, `$SCOPE`, `$TRIGGER`, `$USERNAME`,
  `$DESTINATION` env vars. Those env vars are NOT available to interactive
  shell commands. The bridge scripts do not use hooks: the hand-off should
  happen when the user asks, not on every upload.
- The pinned image ships busybox only: `sh` and `wget`, no `curl`.
  send-to-stirling.sh therefore builds its multipart body by hand and uses
  curl only if one happens to exist.

## Setup (one time, on the box)

1. The catalog entry already mounts `storage/filebrowser/bridge` at
   `/bridge` read-only and sets `FB_DISABLE_EXEC=false`. Put the scripts in
   `storage/filebrowser/bridge/` and `chmod +x` them.
2. In File Browser, log in as admin, go to
   Settings > User Management > edit admin > Commands and add:
   `/bridge/send-to-stirling.sh`
   Save. New-user defaults live under Settings > Global Settings > Commands.
3. Browse to a folder with a PDF, open the shell panel (`< >` in the
   header), and run:
   `/bridge/send-to-stirling.sh "my scan.pdf"`
   The script posts the file to Stirling's compress-pdf API and saves the
   result next to the original as `my scan-stirling.pdf`.

## Scripts

- `send-to-stirling.sh FILE [LEVEL]` posts FILE to Stirling's
  `POST /api/v1/misc/compress-pdf` (verified live against Stirling 3.1.0)
  and writes `NAME-stirling.pdf` beside the original. Stirling must be
  reachable from the File Browser container. Set `STIRLING_URL` to its
  address, for example `http://stirling-host:8400` (the catalog publishes
  Stirling's port on the LAN); the script exits with an error when it is
  not set.
- `send-to-convertx.sh FILE EXT,CONVERTER` is EXPERIMENTAL and unproven:
  ConvertX v0.19.0 has no public API, only its cookie-session web flow, and
  the script needs curl, which the File Browser image does not ship. Set
  `CONVERTX_URL` to ConvertX's address, for example
  `http://convertx-host:8510` (the catalog port for ConvertX); the script
  exits with an error when it is not set. Read the header comment before
  relying on it.

## The Jellyfin half

Not a script: a catalog bind. Jellyfin's entry now also mounts
`storage/filebrowser/files` at `/media/boxdocs:ro`, so everything in File
Browser's home tree is visible to Jellyfin read-only and no file ever has
to move folders to be indexed. See `docs/BRIDGE.md` in the wanderpac repo
for the full three-move pattern.
