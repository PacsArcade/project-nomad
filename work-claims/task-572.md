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

Phase 3 (2026-10-06, same branch, new commit): re-verified against the
latest upstream release, v3.1.0 (published 2026-10-05, image digest
sha256:b5b9e400c086e5334a4947a0d7cd589808f743f29267d7f41c18200cf4bc48b4,
per the Admiral's standing rule to always skin the latest). V3
re-architected Stirling's theming around a semantic --c-* token layer
with per-route prerendered HTML, so this phase:

- rewrote the mapping layers of theme/stirling-pdf/arcade.css onto the
  --c-* tokens (Mapping A), keeping the legacy vocabulary where it
  survives (Mapping B), same fenced customization point on top
- added theme/stirling-pdf/patch-route-html.sh (NEW): injects the
  arcade.css link into every prerendered route page of the running
  container, because a custom index.html alone themes only the root
- bumped the catalog pin in service_seeder.ts from s-pdf:2.13.1 to
  s-pdf:3.1.0

Proof: throwaway 3.1.0 container on lane port 5720, probe shows the
--c-* layer reading the arcade values on both / and /merge, shots at
1440 and true 390 plus the merge tool page read back clean. Full
hand-back: ~/dev/kimi/outbox/task-572/SUMMARY-P3.md.
