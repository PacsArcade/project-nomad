# work-claims/task-572.md

Lane T-572, phase 2: the arcade theme wired into the pilot app,
Stirling PDF (K144 queue, the Admiral drives).

Branch: feat/arcade-theme-stirling, cut from upstream/main (85da928),
the upstream-mirror base. The checkout at ~/dev/apps/project-nomad was
not touched; all work happens in the worktree
~/dev/worktrees/task-572-stirling.

Claimed 2026-10-06 by the T-572 phase 2 builder.

Phase 2 owns in this repo:

- theme/stirling-pdf/arcade.css (NEW): the arcade theme for Stirling
  PDF v2, variables block on top as the ONE customization point,
  Apache-2.0 note consistent with this repo
- admin/database/seeders/service_seeder.ts (ONE bind added): the
  customFiles mount for the Stirling catalog entry, so the theme files
  under storage/stirling-pdf/customFiles reach the container

Proof: a throwaway Stirling container on lane port 5720 (never the box,
whose address stays in the house notes; no house service restarted)
served the theme;
shots at 1440 and true 390 read back clean. Full hand-back:
~/dev/kimi/outbox/task-572/SUMMARY-P2.md.

Read-only this phase: every running container on the box, the NOMAD
house image, the live seeder database on the box.
