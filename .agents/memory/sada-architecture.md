---
name: SADA Platform Architecture
description: Research-grade SADA simulator component layout and key conventions
---

**Stack:** React 19, Vite 8, TypeScript 6, port 5000, host 0.0.0.0

**CSS variables:** `--bg-color`, `--panel-bg`, `--panel-border`, `--accent-color` (#3b82f6), `--sada-color` (#a855f7), `--success` (#10b981), `--danger` (#ef4444), `--text-primary/secondary/muted`

**Key source files:**
- `Simulation.ts` — Agent class, simulate(), PRNG; noiseScale flows through simulate→Agent.step(...)
- `App.tsx` — master state: grid, agentsConfig, beta, historyK, numAgents, noiseScale, step counters
- `SimGrid.tsx` — React.memo + useMemo; heatmap overlay uses blue→yellow→red gradient
- `HeatmapOverlay.tsx` — computeCongestion/Flip/Collision heatmaps + getActiveHeatmap() + heatmapMaxVal()
- `TimelineDebugger.tsx` — time-travel scrubber + per-agent step detail table
- `SimulationControls.tsx` — sidebar: preset selector, β slider, K slider, noise slider, heatmap mode picker
- `ReplayManager.ts` — buildFrames(), packReplay(), saveReplayToJSON(), loadReplayFromFile()
- `StatsPanel.tsx` — exports default StatsPanel AND named `computeStats` (used by App.tsx)

**Why:** `computeStats` named export is needed so App.tsx can compute baseline vs SADA stats for the inline quick-stats row beneath each grid panel without importing the full component.
