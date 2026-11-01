# Unified battle and replay engine

Both the Windows OpenBW battle core and the browser WASM use OpenBW
`4b046d5f65302b10cb0a745f0fecd37ec85b20a8`, with the common changes in
`prepare_engine.py`. Native BWAPI is pinned to
`48124ba8ed1b4d52b3dfd52acbaf34afb9a37fe2`.

The browser artifact is built by `build-unified-engine.yml`. It preserves replay
seeking and manual camera movement. Auto observer, player vision and forced
red/blue controls are hidden because those extensions are absent from this build.

`run_match.py` runs two native modules and records a state fingerprint on every
simulation frame. It requires a natural game end, complementary results, no frame
cap, matching peer states, and a replay fingerprint matching the live game on
every replay frame. A successful parse or reaching the declared last frame alone
does not count as passing.

The fingerprint includes the simulation frame, RNG state, resources, supply, unit
IDs/types/positions/health/shields/orders/targets and remaining build times. It is
a regression check for these state fields, not a proof covering every engine field.

`replay_check.cpp` must be compiled against the same prepared OpenBW sources as
the native match runtime. Set `HOME`, `TMPDIR` and caches to the shared data volume
before building or running on a server. Give concurrent matches distinct `--port`
values. New matches use the original Windows candidate and opponent DLLs, the
original server BWAPI.dll/launcher, and the new Clang-built OpenBWData.dll.
Do not replace these opponent binaries with source builds. The Linux replay
checker uses the same OpenBW revision and common patch.

The Windows core is built by `build-unified-windows.yml` with Clang C++14,
targeting x86. Package its matching C++ runtime. MSVC-built cores were rejected
because their pilot traces diverged from the Linux/WASM simulation.

The browser acceptance mode (`verify=<match-id>-reference.json`) hashes every
actual WASM frame fingerprint and compares the digest with the native replay
trace. Run it in a fresh page without seeking backwards during verification.

The pilot report and browser acceptance evidence are in `verification/unified/`.

The published six are the original archived games, preserving their real wins
and losses. Their full browser traces are compared with fresh native replay
traces; historical live per-frame traces are unavailable. Do not label that
check as a frame-by-frame comparison against the original live matches. The
new Windows pilot separately passed live/native/WASM equivalence.
