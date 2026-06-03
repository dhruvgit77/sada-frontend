import React from 'react';
import type { Agent } from './Simulation';

export type HeatmapMode = 'none' | 'congestion' | 'flips' | 'collision';

const GRID_SIZE = 20;

export function computeCongestionHeatmap(agents: Agent[]): number[][] {
  const hm = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  for (const agent of agents) {
    for (const pos of agent.path) {
      if (pos[0] >= 0 && pos[0] < GRID_SIZE && pos[1] >= 0 && pos[1] < GRID_SIZE) {
        hm[pos[0]][pos[1]]++;
      }
    }
  }
  return hm;
}

export function computeFlipHeatmap(agents: Agent[]): number[][] {
  const hm = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  for (const agent of agents) {
    let prevAction = '';
    for (let i = 0; i < agent.path.length; i++) {
      let action = 'WAIT';
      if (i > 0) {
        const prev = agent.path[i - 1];
        const pos = agent.path[i];
        const dx = pos[0] - prev[0];
        const dy = pos[1] - prev[1];
        if (dx === -1) action = 'UP';
        else if (dx === 1) action = 'DOWN';
        else if (dy === -1) action = 'LEFT';
        else if (dy === 1) action = 'RIGHT';
      }
      if (i > 1 && action !== prevAction && action !== 'WAIT' && prevAction !== 'WAIT') {
        const flipPos = agent.path[i - 1];
        if (flipPos[0] >= 0 && flipPos[0] < GRID_SIZE && flipPos[1] >= 0 && flipPos[1] < GRID_SIZE) {
          hm[flipPos[0]][flipPos[1]]++;
        }
      }
      prevAction = action;
    }
  }
  return hm;
}

export function computeCollisionHeatmap(agents: Agent[]): number[][] {
  const hm = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  if (!agents.length) return hm;
  const maxStep = agents[0].path.length;
  for (let step = 0; step < maxStep; step++) {
    const positions = agents.map(a => a.path[Math.min(step, a.path.length - 1)]);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dist = Math.abs(positions[i][0] - positions[j][0]) + Math.abs(positions[i][1] - positions[j][1]);
        if (dist <= 1) {
          const pi = positions[i], pj = positions[j];
          if (pi[0] >= 0 && pi[0] < GRID_SIZE && pi[1] >= 0 && pi[1] < GRID_SIZE) hm[pi[0]][pi[1]]++;
          if (pj[0] >= 0 && pj[0] < GRID_SIZE && pj[1] >= 0 && pj[1] < GRID_SIZE) hm[pj[0]][pj[1]]++;
        }
      }
    }
  }
  return hm;
}

export function getActiveHeatmap(
  mode: HeatmapMode,
  congestion: number[][],
  flips: number[][],
  collision: number[][]
): number[][] | null {
  if (mode === 'congestion') return congestion;
  if (mode === 'flips') return flips;
  if (mode === 'collision') return collision;
  return null;
}

export function heatmapMaxVal(hm: number[][] | null): number {
  if (!hm) return 1;
  let max = 1;
  for (const row of hm) for (const v of row) if (v > max) max = v;
  return max;
}

interface HeatmapOverlayProps {
  mode: HeatmapMode;
  onModeChange: (mode: HeatmapMode) => void;
}

const MODES: { value: HeatmapMode; label: string; icon: string }[] = [
  { value: 'none', label: 'None', icon: '○' },
  { value: 'congestion', label: 'Congestion', icon: '🔥' },
  { value: 'flips', label: 'Flips', icon: '🔄' },
  { value: 'collision', label: 'Collision', icon: '⚡' },
];

const HeatmapOverlay = React.memo(function HeatmapOverlay({ mode, onModeChange }: HeatmapOverlayProps) {
  return (
    <div className="heatmap-control">
      <div className="heatmap-title">🗺️ Heatmap Overlay</div>
      <div className="heatmap-modes">
        {MODES.map(m => (
          <button
            key={m.value}
            className={`heatmap-mode-btn${mode === m.value ? ' active' : ''}`}
            onClick={() => onModeChange(m.value)}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      {mode !== 'none' && (
        <div className="heatmap-legend">
          <span className="legend-label">Low</span>
          <div className="legend-gradient" />
          <span className="legend-label">High</span>
        </div>
      )}
    </div>
  );
});

export default HeatmapOverlay;
