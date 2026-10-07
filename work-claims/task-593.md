# T-593 claim: join podman host-containers-internal into the box line

Lane T-593 (Ms. Kimi, brief TASK-593-join-podman-host-containers-internal.md
in the kimi house repo, Admiral ruling A on Desk card 970276). Branch
`feat/join-podman-host-containers`, cut from `feat/join-box-line` tip
`a563145` (the future box line; the T-591 join PR is being pushed by
Number One on his A).

The move: merge `feat/podman-host-containers-internal` (`02a435f`) INTO
this branch. T-591 found that podman host-containers-internal was never
on the box line; it lived unmerged at `02a435f` (3 files:
benchmark_service.ts, admin/app/utils/self_hosted_url.ts,
admin/tests/unit/self_hosted_url.spec.ts). This lane carries it onto the
box line exactly as `02a435f` holds it. No upgrade, no feature work.

The PR targets `wanderpac/lumen-test`, not main, and merges AFTER the
T-591 join PR (this branch is stacked on `feat/join-box-line` at
`a563145`). Number One pushes on the Admiral's word; the builder never
pushes.

OWNS in this repo: the merge resolution on this branch, this claim file.

READ-ONLY: the live box, every running service, the wanderpac repo,
`main`, `wanderpac/lumen-test`, and `feat/join-box-line` themselves (no
direct commits to any of them).
