# contrib/file-bridge: hand files to the working apps, no click required

The WanderPac bridge pattern in one folder. Two carriers run these scripts:

- **copyparty** (the copyparty catalog entry): an `xau` hook fires
  `on-upload.sh` every time a file lands, and the file itself is the whole
  user story. Drop a PDF in the folder, the compressed copy appears beside
  it. This is the no-click bridge proven in lane T-576.
- **File Browser** (the current file app): the same two hand-off scripts
  run from its shell panel (the `< >` button in the header), typed by hand.

## Scripts

- `on-upload.sh` (copyparty xau hook entry): dispatch only. PDFs go to
  Stirling, office docs to ConvertX as PDF, images to ConvertX as WebP,
  audio to ConvertX as MP3; everything else is left alone. Hook outputs
  and marker files are never re-processed, so there is no loop.
- `send-to-stirling.sh FILE [LEVEL]` posts FILE to Stirling's
  `POST /api/v1/misc/compress-pdf` (verified live against Stirling 3.1.0)
  and writes `NAME-stirling.pdf` beside the original. The file rides on
  stdin under the fixed name `upload.pdf`, so commas, semicolons, and
  quotes in the real name cannot break curl's multipart parser. Stirling
  must be reachable from the container. Set `STIRLING_URL` to its
  address; the copyparty catalog entry wires it to the Stirling service
  name on the NOMAD network.
- `send-to-convertx.sh FILE EXT,CONVERTER` drives ConvertX's
  cookie-session web flow (ConvertX v0.19.0 has no public API). It needs
  curl, or python3 when curl is absent (the copyparty container ships
  python3, so the hook path works there). Set `CONVERTX_URL`; the copyparty catalog entry wires it to the
  ConvertX service name. ConvertX must run with
  `ALLOW_UNAUTHENTICATED=true` and `HTTP_ALLOWED=true`; the seeded
  ConvertX entry keeps accounts on, so this hand-off needs that one-time
  flip (Manage > Edit on ConvertX) before it can work.
- Failure is visible: when a hand-off fails, the scripts write
  `NAME.bridge-failed` beside the upload, so the failure shows in the
  file listing. The next successful hand-off clears it.
- ConvertX archive safety: the answer tar is listed before extraction
  into a mktemp dir, members with `..` or absolute paths are rejected,
  and only regular top-level files move into the folder.

## copyparty setup

Nothing to do: the copyparty catalog entry's install step copies these
scripts into `storage/copyparty/hooks` and mounts them read-only at
`/hooks`, and the generated volume config points the `xau` flag at
`/hooks/on-upload.sh`.

## File Browser setup (one time, on the box)

What File Browser v2.63.23 actually supports (verified against upstream
source at the pinned tag):

- The interactive shell (header `< >` button, websocket `/api/command`)
  runs a typed command in the folder you are browsing. It does NOT
  receive the selected file; you type the file name yourself.
- The command must be allowlisted per user:
  Settings > User Management > edit the user > Commands. Allowlist the
  full script path, for example `/bridge/send-to-stirling.sh`.
- The user also needs the Execute permission (the seeded admin has it).
- Command execution is DISABLED by default since v2.33.8 (upstream's
  issue 5199). The catalog entry sets `FB_DISABLE_EXEC=false`. Only
  allowlisted command paths run; do not allowlist a bare shell.
- The pinned image ships busybox only: `sh` and `wget`, no `curl`.
  send-to-stirling.sh falls back to a hand-built multipart body;
  send-to-convertx.sh needs curl and cannot run in that container.

Steps:

1. The catalog entry mounts `storage/filebrowser/bridge` at `/bridge`
   read-only. Put `send-to-stirling.sh` and `send-to-convertx.sh` in
   `storage/filebrowser/bridge/` and `chmod +x` them.
2. In File Browser, log in as admin, go to
   Settings > User Management > edit admin > Commands and add:
   `/bridge/send-to-stirling.sh`
3. Browse to a folder with a PDF, open the shell panel, and run:
   `/bridge/send-to-stirling.sh "my scan.pdf"`

## The Jellyfin half

Not a script: a catalog bind. Jellyfin's entry now also mounts
`storage/filebrowser/files` at `/media/boxdocs:ro`, so everything in File
Browser's home tree is visible to Jellyfin read-only and no file ever has
to move folders to be indexed. See `docs/BRIDGE.md` in the wanderpac repo
for the full pattern.
