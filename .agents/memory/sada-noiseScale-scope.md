---
name: SADA noiseScale scope fix
description: noiseScale must be threaded as a parameter through Agent.step(), not assumed in class method scope
---

**Rule:** Any parameter of `simulate()` that needs to be used inside `Agent.step()` must be explicitly passed as a parameter to `step()`. TypeScript class methods do not inherit outer function-scope variables.

**Why:** The `noiseScale` param was added to `simulate(grid, config, use_sada, maxSteps, noiseScale)` and referenced inside `Agent.step()` which has its own scope. This caused a `ReferenceError: noiseScale is not defined` at runtime.

**How to apply:** `Agent.step()` signature is `step(grid, otherAgents, prng, noiseScale = 1.0)` and the call site in `simulate()` is `agents[i].step(grid, others, prng, noiseScale)`. Any future params added to simulate() that are needed in step() must follow the same pattern.
