# T-575 claim: the file bridge (File Browser hands files to working apps; Jellyfin sees boxdocs)

Lane T-575 (Ms. Kimi, brief inbox/TASK-575-wanderpac-file-bridge.md in the
kimi house repo). Branch `feat/file-bridge`, cut stacked on the T-574 tip
`6a8e034574c9dcb52d6e6536c5ade3b90833797c` (`feat/arcade-theme-filebrowser`)
because both lanes touch `admin/database/seeders/service_seeder.ts`.

OWNS in this repo: the Jellyfin entry's bind list and (if needed) the File
Browser entry in `admin/database/seeders/service_seeder.ts` (one commit per
app), the hand-off script(s) and their doc under `contrib/file-bridge/`,
this claim file.

READ-ONLY: the live box and all containers, every other catalog entry,
T-574's theme files, all upstreams.

The proof run (throwaway rootless podman pair on lane ports 5750-5753, a
real PDF sent from File Browser to Stirling, shots at 1440 and 390) lives in
the kimi house outbox `outbox/task-575/SUMMARY.md`. The bridge pattern doc
(`docs/BRIDGE.md`) lands in the wanderpac repo on
`feat/task-572-arcade-theme-tokens`.
