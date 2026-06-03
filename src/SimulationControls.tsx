import React from 'react';
import type { AgentConfig } from './Simulation';
import HeatmapOverlay, { type HeatmapMode } from './HeatmapOverlay';

interface Preset {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface SimulationControlsProps {
  activePresetId: string;
  presets: Preset[];
  onLoadPreset: (id: string) => void;
  beta: number;
  onBeta: (v: number) => void;
  historyK: number;
  onHistoryK: (v: number) => void;
  numAgents: number;
  onNumAgents: (v: number) => void;
  noiseScale: number;
  onNoiseScale: (v: number) => void;
  agentsConfig: AgentConfig[];
  showTrails: boolean;
  onShowTrails: (v: boolean) => void;
  heatmapMode: HeatmapMode;
  onHeatmapMode: (m: HeatmapMode) => void;
  onRecalculate: () => void;
}

const SimulationControls = React.memo(function SimulationControls({
  activePresetId, presets, onLoadPreset,
  beta, onBeta,
  historyK, onHistoryK,
  numAgents, onNumAgents,
  noiseScale, onNoiseScale,
  agentsConfig,
  showTrails, onShowTrails,
  heatmapMode, onHeatmapMode,
  onRecalculate,
}: SimulationControlsProps) {
  return (
    <div className="sidebar-card">
      <div className="sidebar-title">⚙️ Parameters</div>

      <label className="field-label">Environment</label>
      <select
        className="field-select"
        value={activePresetId}
        onChange={e => onLoadPreset(e.target.value)}
      >
        {presets.map(p => (
          <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
        ))}
      </select>
      <p className="field-hint">
        {presets.find(p => p.id === activePresetId)?.description}
      </p>

      <div className="divider" />

      <div className="slider-row">
        <label>Stability Penalty β</label>
        <span className="slider-val">{beta.toFixed(1)}</span>
      </div>
      <input
        type="range" min="0" max="20" step="0.5" value={beta}
        onChange={e => onBeta(parseFloat(e.target.value))}
      />
      <p className="field-hint">Higher = stronger jitter suppression (may deadlock at extremes)</p>

      <div className="slider-row">
        <label>History Window K</label>
        <span className="slider-val">{historyK}</span>
      </div>
      <input
        type="range" min="1" max="15" step="1" value={historyK}
        onChange={e => onHistoryK(parseInt(e.target.value))}
      />
      <p className="field-hint">Sliding window of actions used for flip-count evaluation</p>

      <div className="slider-row">
        <label>Agent Count</label>
        <span className="slider-val">{numAgents}</span>
      </div>
      <input
        type="range" min="1" max={agentsConfig.length} step="1" value={numAgents}
        onChange={e => onNumAgents(parseInt(e.target.value))}
      />

      <div className="slider-row">
        <label>Noise Scale</label>
        <span className="slider-val">{noiseScale.toFixed(1)}</span>
      </div>
      <input
        type="range" min="0" max="2" step="0.1" value={noiseScale}
        onChange={e => onNoiseScale(parseFloat(e.target.value))}
      />
      <p className="field-hint">Stochastic perturbation in cost evaluation (0 = fully deterministic)</p>

      <div className="divider" />

      <label className="toggle-label">
        <input
          type="checkbox"
          checked={showTrails}
          onChange={e => onShowTrails(e.target.checked)}
        />
        <span className="toggle-track"><span className="toggle-thumb" /></span>
        Show Path Trails
      </label>

      <div className="divider" />

      <HeatmapOverlay mode={heatmapMode} onModeChange={onHeatmapMode} />

      <button className="btn-primary" onClick={onRecalculate}>↺ Recalculate</button>
      <p className="field-hint" style={{ marginTop: '0.5rem' }}>
        💡 <strong>Map Editor:</strong> Click/drag on grids to paint walls
      </p>
    </div>
  );
});

export default SimulationControls;
