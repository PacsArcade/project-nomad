# T-597 claim: the arcade theme on Files (copyparty), house arcade.css form

Lane T-597 (Ms. Kimi, brief inbox/TASK-597-arcade-theme-copyparty.md in
the kimi house repo). Branch `feat/arcade-theme-copyparty`, cut from
origin/main (a0a12fe, fetched and verified at cut on 2026-10-07).

Origin: the Admiral's ruling on Desk card 970286 (letter A, 2026-10-07:
"let's look at the next skin items, don't want to waste any time").
Third themed app after Stirling PDF (T-572) and File Browser (T-574).

What this lane does: T-585 shipped copyparty to the catalog WITH the
arcade look already applied, as one inline `<style>` block inside
`theme/copyparty/head.html` (the `--html-head` native hook). That works,
but it breaks the house pattern: the other two themed apps carry their
look as `theme/<app>/arcade.css`, one variables block between BEGIN and
END fences, the file the app's native hook serves. This lane moves the
copyparty look into `theme/copyparty/arcade.css` in exactly that form,
and rewires the delivery so the app itself serves the stylesheet:

- `theme/copyparty/arcade.css` (the look; the ONE customization point,
  the 55 house tokens, Apache 2.0 header, same contract as the Stirling
  and File Browser files).
- `theme/copyparty/head.html` shrinks to the delivery mechanism: one
  `<link>` line to `/theme/arcade.css`, like Stirling's index.html copy.
- The generated `copyparty.conf` gains a small read-only `[/theme]`
  volume (nomad-only read, hidden from listings via the `unlist`
  volflag) so copyparty itself serves the stylesheet. Same guards as
  T-585: house-owned, read-only mount, outside the served `/w` tree.
- The preinstall action copies both theme files; the Dockerfile asset
  COPY picks up arcade.css.

OWNS in this repo: `theme/copyparty/` (both files), the copyparty
preinstall action in `admin/app/services/docker_service.ts`, the
Dockerfile copyparty asset lines, this claim file.

READ-ONLY: every other catalog app and theme, the live box, copyparty
upstream, the wanderpac repo. Never pushed (Number One pushes, the
Admiral merges). No house network address appears anywhere in this lane.

The throwaway proof (lane ports 5970-5973) and its shots live in the
kimi house outbox `outbox/task-597/SUMMARY.md`.
