# T-585 claim: add copyparty to the app catalog (the File Browser successor-in-waiting)

Lane T-585 (Ms. Kimi, brief inbox/TASK-585-wanderpac-copyparty-catalog.md in
the kimi house repo). Branch `feat/add-copyparty`, cut from origin/main
(50905f8, fetched and verified at cut on 2026-10-06).

Origin: the Admiral's ruling on Desk card 970211 (letter A: "yes good on
copy party we want that") and his image ruling on Desk card 970216 (ruling A:
the full image WITH media previews and thumbnails, digest-pinned). Phase 0
security verdict: outbox/task-585/SECURITY.md (ADOPT-WITH-GUARDS, guards
G1-G8 hard). Phase 1 phone mockup: forge set copyparty-phone-r1-970217,
marked by the Admiral 2026-10-06 with two pins binding the theme (icons get
labels or tooltips; upstream's mark lives only where credit lives, nothing
that looks clickable without going somewhere real).

OWNS in this repo: the copyparty catalog entry
(`admin/constants/service_names.ts`,
`admin/database/seeders/service_seeder.ts`,
`admin/constants/supply_depot_docs.ts`,
`admin/docs/supply-depot-apps.md`,
`admin/inertia/lib/icons.ts`), the copyparty preinstall action in
`admin/app/services/docker_service.ts`, the digest-pin fixes
(`admin/app/services/container_registry_service.ts`,
`admin/app/services/docker_service.ts` `_checkImageExists`, unit tests),
the copyparty theme (`theme/copyparty/`), the file-bridge script fixes
(`contrib/file-bridge/`, findings 2 and 3 of the security read, plus the
comma fix and the visible failure marker), this claim file.

READ-ONLY: every other catalog app, the live box, copyparty upstream, the
wanderpac repo.

The throwaway proof (catalog-definition container on lane port 5850,
throwaway Stirling on 5851, throwaway ConvertX on 5852) and its numbers
live in the kimi house outbox `outbox/task-585/SUMMARY.md`.
