# T-589 claim: repair the pre-existing failing app_auto_update.spec.ts on main

Lane T-589 (Ms. Kimi, brief inbox/TASK-589-fork-auto-update-spec-fix.md in the
kimi house repo). Branch `fix/app-auto-update-spec`, cut from origin/main
(`50905f8`, the merge of feat/arcade-theme-stirling). Independent of T-585's
branch; only the boot-helper pattern is borrowed from its commit `a8ea7cf`.

Failure reproduced on this clean worktree off origin/main before any change:

```
$ node --import ts-node-maintained/register/esm --test tests/unit/app_auto_update.spec.ts
file:///.../@adonisjs/core/build/services/logger.js:15
await app.booted(async () => {
          ^
TypeError: Cannot read properties of undefined (reading 'booted')
    at file:///.../@adonisjs/core/build/services/logger.js:15:11
Node.js v26.10.0
✖ tests/unit/app_auto_update.spec.ts
ℹ pass 0 / fail 1
```

Diagnosis: `AppAutoUpdateService` and `ContainerRegistryService` both import
the `@adonisjs/core/services/logger` singleton at module scope; that module
top-level-awaits `app.booted(...)`, and under plain `node --test` no app
exists, so the import itself throws before any test body runs. The code under
test is not wrong; the spec just never booted an app.

Fix: boot the minimal app context in the spec setup via the new
`tests/unit/helpers/boot_services_app.ts` (the pattern T-585 proved in
`a8ea7cf`), then dynamic-import the service modules. The spec's assertions
are untouched.

OWNS in this repo: `admin/tests/unit/app_auto_update.spec.ts`,
`admin/tests/unit/helpers/boot_services_app.ts`, this claim file.

READ-ONLY: everything else, especially the code under test
(`admin/app/services/app_auto_update_service.ts`,
`admin/app/services/container_registry_service.ts`).
