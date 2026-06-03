import { useState, useEffect, useCallback, useMemo } from 'react';
import './index.css';
import { simulate, type AgentConfig } from './Simulation';
import SimGrid from './SimGrid';
import StatsPanel, { computeStats } from './StatsPanel';
import Inspector from './Inspector';
import BatchSandbox from './BatchSandbox';
import ResultsAnalyzer from './ResultsAnalyzer';
import SimulationControls from './SimulationControls';
import TimelineDebugger from './TimelineDebugger';
import {
  computeCongestionHeatmap,
  computeFlipHeatmap,
  computeCollisionHeatmap,
  getActiveHeatmap,
  heatmapMaxVal,
  type HeatmapMode,
} from './HeatmapOverlay';
import {
  buildFrames,
  packReplay,
  saveReplayToJSON,
  loadReplayFromFile,
  type ReplayFrame,
} from './ReplayManager';

const GRID_SIZE = 20;
type DomainMode = 'abstract' | 'warehouse' | 'evacuation';
const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

function makeEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

const PRESETS = [
  {
    id: 'swap', name: 'Opposite Swap',
    description: 'Agents cross head-on — classic jitter trigger.',
    icon: '🔀',
    grid: (() => {
      const g = makeEmptyGrid();
      [[6,6],[6,7],[7,6],[7,7],[12,12],[12,13],[13,12],[13,13],[6,12],[6,13],[7,12],[7,13],[12,6],[12,7],[13,6],[13,7]].forEach(([r,c]) => g[r][c]=1);
      return g;
    })(),
    agents: [
      { id:1, start:[2,10]  as [number,number], goal:[18,10] as [number,number], K:5, beta:8, color:colors[0] },
      { id:2, start:[18,10] as [number,number], goal:[2,10]  as [number,number], K:5, beta:8, color:colors[1] },
      { id:3, start:[10,2]  as [number,number], goal:[10,18] as [number,number], K:5, beta:8, color:colors[2] },
      { id:4, start:[10,18] as [number,number], goal:[10,2]  as [number,number], K:5, beta:8, color:colors[3] },
      { id:5, start:[2,2]   as [number,number], goal:[18,18] as [number,number], K:5, beta:8, color:colors[4] },
    ] as AgentConfig[]
  },
  {
    id: 'corridor', name: 'Narrow Corridor',
    description: 'One-cell bottleneck wall — extreme congestion.',
    icon: '🚧',
    grid: (() => {
      const g = makeEmptyGrid();
      for (let r=0; r<GRID_SIZE; r++) if (r<8||r>11) { g[r][9]=1; g[r][10]=1; }
      return g;
    })(),
    agents: [
      { id:1, start:[4,2]   as [number,number], goal:[4,17]  as [number,number], K:5, beta:8, color:colors[0] },
      { id:2, start:[15,2]  as [number,number], goal:[15,17] as [number,number], K:5, beta:8, color:colors[1] },
      { id:3, start:[4,17]  as [number,number], goal:[4,2]   as [number,number], K:5, beta:8, color:colors[2] },
      { id:4, start:[15,17] as [number,number], goal:[15,2]  as [number,number], K:5, beta:8, color:colors[3] },
      { id:5, start:[10,2]  as [number,number], goal:[10,17] as [number,number], K:5, beta:8, color:colors[4] },
    ] as AgentConfig[]
  },
  {
    id: 'crossing', name: '4-Way Intersection',
    description: 'Cardinal paths cross at center — deadlock risk.',
    icon: '✚',
    grid: (() => {
      const g = makeEmptyGrid();
      for (let r=0;r<7;r++) for (let c=0;c<7;c++) g[r][c]=1;
      for (let r=0;r<7;r++) for (let c=13;c<GRID_SIZE;c++) g[r][c]=1;
      for (let r=13;r<GRID_SIZE;r++) for (let c=0;c<7;c++) g[r][c]=1;
      for (let r=13;r<GRID_SIZE;r++) for (let c=13;c<GRID_SIZE;c++) g[r][c]=1;
      return g;
    })(),
    agents: [
      { id:1, start:[1,10]  as [number,number], goal:[18,10] as [number,number], K:5, beta:8, color:colors[0] },
      { id:2, start:[18,10] as [number,number], goal:[1,10]  as [number,number], K:5, beta:8, color:colors[1] },
      { id:3, start:[10,1]  as [number,number], goal:[10,18] as [number,number], K:5, beta:8, color:colors[2] },
      { id:4, start:[10,18] as [number,number], goal:[10,1]  as [number,number], K:5, beta:8, color:colors[3] },
    ] as AgentConfig[]
  },
  {
    id: 'warehouse', name: 'Warehouse Maze',
    description: 'Shelf aisles — coordination required at each end-cap.',
    icon: '📦',
    grid: (() => {
      const g = makeEmptyGrid();
      for (const c of [4,8,12,16]) {
        for (let r=2;r<8;r++) g[r][c]=1;
        for (let r=12;r<18;r++) g[r][c]=1;
      }
      return g;
    })(),
    agents: [
      { id:1, start:[1,1]   as [number,number], goal:[18,18] as [number,number], K:5, beta:8, color:colors[0] },
      { id:2, start:[18,1]  as [number,number], goal:[1,18]  as [number,number], K:5, beta:8, color:colors[1] },
      { id:3, start:[1,18]  as [number,number], goal:[18,1]  as [number,number], K:5, beta:8, color:colors[2] },
      { id:4, start:[18,18] as [number,number], goal:[1,1]   as [number,number], K:5, beta:8, color:colors[3] },
    ] as AgentConfig[]
  },
];

export default function App() {
  const [activePresetId, setActivePresetId] = useState('corridor');
  const [grid, setGrid]                     = useState(() => PRESETS[1].grid.map(r => [...r]));
  const [agentsConfig, setAgentsConfig]     = useState<AgentConfig[]>(PRESETS[1].agents);

  const [beta, setBeta]             = useState(8.0);
  const [historyK, setHistoryK]     = useState(5);
  const [numAgents, setNumAgents]   = useState(4);
  const [noiseScale, setNoiseScale] = useState(1.0);
  const [speed, setSpeed]           = useState(150);
  const [domainMode, setDomainMode] = useState<DomainMode>('warehouse');
  const [showTrails, setShowTrails] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none');
  const [selectedAgentId, setSelectedAgentId]   = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'sim'|'analytics'|'results'|'explainer'>('sim');

  const [baselineAgents, setBaselineAgents] = useState(() =>
    simulate(grid, PRESETS[1].agents.slice(0,4), false, 200, 1.0)
  );
  const [sadaAgents, setSadaAgents] = useState(() =>
    simulate(grid, PRESETS[1].agents.slice(0,4), true,  200, 1.0)
  );

  const [baselineFrames, setBaselineFrames] = useState<ReplayFrame[]>(() =>
    buildFrames(simulate(grid, PRESETS[1].agents.slice(0,4), false, 200, 1.0))
  );
  const [sadaFrames, setSadaFrames] = useState<ReplayFrame[]>(() =>
    buildFrames(simulate(grid, PRESETS[1].agents.slice(0,4), true, 200, 1.0))
  );

  const [replayStatus, setReplayStatus] = useState<string>('');

  const [baseStep, setBaseStep] = useState(0);
  const [sadaStep, setSadaStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawType, setDrawType]   = useState<number>(1);

  /* ── Heatmaps (memoised) ─────────────────────────────────── */
  const activeAgents  = useMemo(() => baselineAgents.slice(0, numAgents), [baselineAgents, numAgents]);
  const activeSada    = useMemo(() => sadaAgents.slice(0, numAgents),     [sadaAgents, numAgents]);

  const baseCongestion = useMemo(() => computeCongestionHeatmap(activeAgents), [activeAgents]);
  const baseFlips      = useMemo(() => computeFlipHeatmap(activeAgents),      [activeAgents]);
  const baseCollision  = useMemo(() => computeCollisionHeatmap(activeAgents), [activeAgents]);

  const sadaCongestion = useMemo(() => computeCongestionHeatmap(activeSada), [activeSada]);
  const sadaFlipMap    = useMemo(() => computeFlipHeatmap(activeSada),       [activeSada]);
  const sadaCollision  = useMemo(() => computeCollisionHeatmap(activeSada),  [activeSada]);

  const baseHeatmap = useMemo(
    () => getActiveHeatmap(heatmapMode, baseCongestion, baseFlips, baseCollision),
    [heatmapMode, baseCongestion, baseFlips, baseCollision]
  );
  const sadaHeatmap = useMemo(
    () => getActiveHeatmap(heatmapMode, sadaCongestion, sadaFlipMap, sadaCollision),
    [heatmapMode, sadaCongestion, sadaFlipMap, sadaCollision]
  );

  const baseHeatmapMax = useMemo(() => heatmapMaxVal(baseHeatmap), [baseHeatmap]);
  const sadaHeatmapMax = useMemo(() => heatmapMaxVal(sadaHeatmap), [sadaHeatmap]);

  /* ── Stats ────────────────────────────────────────────────── */
  const baseStats = useMemo(() => computeStats(activeAgents), [activeAgents]);
  const sadaStats = useMemo(() => computeStats(activeSada),   [activeSada]);

  const baseMax   = baselineAgents.length ? baselineAgents[0].path.length - 1 : 0;
  const sadaMax   = sadaAgents.length     ? sadaAgents[0].path.length - 1     : 0;
  const globalMax = Math.max(baseMax, sadaMax);

  /* ── Run Simulation ───────────────────────────────────────── */
  const runSim = useCallback((g: number[][], cfg: AgentConfig[]) => {
    const active = cfg.slice(0, numAgents).map(c => ({ ...c, beta, K: historyK }));
    const base = simulate(g, active, false, 200, noiseScale);
    const sada = simulate(g, active, true,  200, noiseScale);
    setBaselineAgents(base);
    setSadaAgents(sada);
    setBaselineFrames(buildFrames(base));
    setSadaFrames(buildFrames(sada));
    setBaseStep(0);
    setSadaStep(0);
    setIsPlaying(false);
    setReplayStatus('');
  }, [numAgents, beta, historyK, noiseScale]);

  useEffect(() => { runSim(grid, agentsConfig); }, []);

  /* ── Animation Loop ───────────────────────────────────────── */
  useEffect(() => {
    if (!isPlaying) return;
    if (baseStep >= baseMax && sadaStep >= sadaMax) { setIsPlaying(false); return; }
    const id = setInterval(() => {
      setBaseStep(s => s < baseMax ? s + 1 : s);
      setSadaStep(s => s < sadaMax ? s + 1 : s);
    }, speed);
    return () => clearInterval(id);
  }, [isPlaying, speed, baseStep, sadaStep, baseMax, sadaMax]);

  /* ── Preset Load ──────────────────────────────────────────── */
  const loadPreset = useCallback((pid: string) => {
    const p = PRESETS.find(p => p.id === pid)!;
    setActivePresetId(pid);
    const g = p.grid.map(r => [...r]);
    setGrid(g);
    setAgentsConfig(p.agents);
    setNumAgents(Math.min(p.agents.length, numAgents));
    const active = p.agents.slice(0, Math.min(p.agents.length, numAgents)).map(c => ({ ...c, beta, K: historyK }));
    const base = simulate(g, active, false, 200, noiseScale);
    const sada = simulate(g, active, true,  200, noiseScale);
    setBaselineAgents(base);
    setSadaAgents(sada);
    setBaselineFrames(buildFrames(base));
    setSadaFrames(buildFrames(sada));
    setBaseStep(0); setSadaStep(0); setIsPlaying(false);
  }, [numAgents, beta, historyK, noiseScale]);

  /* ── Map Painting ─────────────────────────────────────────── */
  const paintCell = useCallback((r: number, c: number, t: number) => {
    const blocked = agentsConfig.some(a =>
      (a.start[0]===r&&a.start[1]===c)||(a.goal[0]===r&&a.goal[1]===c)
    );
    if (blocked) return;
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = t;
      return next;
    });
  }, [agentsConfig]);

  const handleCellDown = useCallback((r: number, c: number) => {
    const blocked = agentsConfig.some(a =>
      (a.start[0]===r&&a.start[1]===c)||(a.goal[0]===r&&a.goal[1]===c)
    );
    if (blocked) return;
    const t = grid[r][c] === 1 ? 0 : 1;
    setDrawType(t);
    setIsDrawing(true);
    paintCell(r, c, t);
  }, [agentsConfig, grid, paintCell]);

  const handleCellEnter = useCallback((r: number, c: number) => {
    if (!isDrawing) return;
    paintCell(r, c, drawType);
  }, [isDrawing, drawType, paintCell]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setGrid(prev => {
        runSim(prev, agentsConfig);
        return prev;
      });
    }
  }, [isDrawing, agentsConfig, runSim]);

  /* ── Scrubber ─────────────────────────────────────────────── */
  const handleScrub = useCallback((v: number) => {
    setSadaStep(Math.min(v, sadaMax));
    setBaseStep(Math.min(v, baseMax));
    setIsPlaying(false);
  }, [sadaMax, baseMax]);

  const handleStepForward = useCallback(() => {
    setBaseStep(s => Math.min(s + 1, baseMax));
    setSadaStep(s => Math.min(s + 1, sadaMax));
    setIsPlaying(false);
  }, [baseMax, sadaMax]);

  const handleStepBack = useCallback(() => {
    setBaseStep(s => Math.max(s - 1, 0));
    setSadaStep(s => Math.max(s - 1, 0));
    setIsPlaying(false);
  }, []);

  /* ── Replay ───────────────────────────────────────────────── */
  const handleSaveBaseReplay = useCallback(() => {
    const active = agentsConfig.slice(0, numAgents).map(c => ({ ...c, beta, K: historyK }));
    const data = packReplay(simulate(grid, active, false, 200, noiseScale), false, beta, historyK);
    saveReplayToJSON(data);
  }, [agentsConfig, numAgents, beta, historyK, grid, noiseScale]);

  const handleSaveSadaReplay = useCallback(() => {
    const active = agentsConfig.slice(0, numAgents).map(c => ({ ...c, beta, K: historyK }));
    const data = packReplay(simulate(grid, active, true, 200, noiseScale), true, beta, historyK);
    saveReplayToJSON(data);
  }, [agentsConfig, numAgents, beta, historyK, grid, noiseScale]);

  const handleLoadReplay = useCallback(async () => {
    setReplayStatus('Loading…');
    const data = await loadReplayFromFile();
    if (!data) { setReplayStatus('❌ Invalid replay file'); return; }
    setReplayStatus(`✓ Loaded ${data.isSada ? 'SADA' : 'Baseline'} replay — ${data.totalSteps} steps, β=${data.beta}, K=${data.historyK}`);
  }, []);

  /* ── Inline stats for grid panels ───────────────────────────── */
  const baseFlipCount = useMemo(
    () => activeAgents.reduce((s, a) => s + a.flips, 0), [activeAgents]
  );
  const sadaFlipCount = useMemo(
    () => activeSada.reduce((s, a) => s + a.flips, 0), [activeSada]
  );

  return (
    <div className="app" onMouseUp={handleMouseUp}>

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-left">
          <div className="hero-logo">SADA</div>
          <div>
            <h1 className="hero-title">Stability-Aware Decision Algorithm</h1>
            <p className="hero-sub">
              Solving multi-agent congestion through temporal stability — applied to{' '}
              <strong>{domainMode === 'warehouse' ? 'Warehouse Logistics' : domainMode === 'evacuation' ? 'Emergency Evacuation' : 'Abstract Grid'}</strong>
            </p>
          </div>
        </div>
        <div className="domain-tabs">
          {(['abstract','warehouse','evacuation'] as DomainMode[]).map(d => (
            <button
              key={d}
              className={`domain-tab${domainMode===d?' active':''}`}
              onClick={() => setDomainMode(d)}
            >
              {d==='abstract'?'📐 Grid':d==='warehouse'?'🤖 Warehouse':'🚪 Evacuation'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Problem Banner ────────────────────────────────────────── */}
      <div className={`problem-banner ${domainMode}`}>
        {domainMode === 'warehouse' && <>
          <span className="banner-icon">⚡</span>
          <div>
            <strong>Real Problem: AGV Fleet Jitter in Automated Warehouses</strong>
            <p>Standard path planners cause delivery robots to oscillate back-and-forth at bottlenecks, draining battery by up to 5× per reversal and increasing motor wear. SADA eliminates this by penalising direction changes.</p>
          </div>
        </>}
        {domainMode === 'evacuation' && <>
          <span className="banner-icon">🚨</span>
          <div>
            <strong>Real Problem: Panic Turbulence in Emergency Evacuations</strong>
            <p>Crowd simulation studies show that indecisive agents constantly changing direction block corridors and reduce safe-egress throughput by up to 40%. SADA enforces decisive, smooth movement even under congestion.</p>
          </div>
        </>}
        {domainMode === 'abstract' && <>
          <span className="banner-icon">🔬</span>
          <div>
            <strong>Research Problem: Decision Jitter in Decentralised Multi-Agent Systems</strong>
            <p>Greedy local planners suffer oscillatory behaviour when agents share constrained grid space. SADA's flip-penalised cost function resolves this without global coordination overhead.</p>
          </div>
        </>}
      </div>

      {/* ── Nav Tabs ──────────────────────────────────────────────── */}
      <nav className="section-nav">
        {(['sim','analytics','results','explainer'] as const).map(s => (
          <button
            key={s}
            className={`nav-btn${activeSection===s?' active':''}`}
            onClick={() => setActiveSection(s)}
          >
            {s==='sim'?'🎮 Live Simulation':s==='analytics'?'📊 Performance Analytics':s==='results'?'📈 Results Analysis':'🧠 Algorithm Explainer'}
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1: LIVE SIMULATION
      ══════════════════════════════════════════════════════════ */}
      {activeSection === 'sim' && (
        <div className="sim-section">

          {/* ── Left Sidebar ────────────────────────────────────── */}
          <div className="sidebar">
            <SimulationControls
              activePresetId={activePresetId}
              presets={PRESETS}
              onLoadPreset={loadPreset}
              beta={beta}
              onBeta={setBeta}
              historyK={historyK}
              onHistoryK={setHistoryK}
              numAgents={numAgents}
              onNumAgents={setNumAgents}
              noiseScale={noiseScale}
              onNoiseScale={setNoiseScale}
              agentsConfig={agentsConfig}
              showTrails={showTrails}
              onShowTrails={setShowTrails}
              heatmapMode={heatmapMode}
              onHeatmapMode={setHeatmapMode}
              onRecalculate={() => runSim(grid, agentsConfig)}
            />

            {/* Completion Status Card */}
            <div className="sidebar-card status-card">
              <div className="sidebar-title">🏁 Completion Status</div>
              <div className="status-row">
                <span className="status-label baseline-label">Baseline</span>
                <div className="progress-bar-track">
                  <div className="progress-bar base-progress" style={{ width: `${baseMax>0?(baseStep/baseMax)*100:0}%` }} />
                </div>
                <span className="progress-pct">{baseMax>0?Math.round((baseStep/baseMax)*100):0}%</span>
              </div>
              <div className="status-row">
                <span className="status-label sada-label">SADA</span>
                <div className="progress-bar-track">
                  <div className="progress-bar sada-progress" style={{ width: `${sadaMax>0?(sadaStep/sadaMax)*100:0}%` }} />
                </div>
                <span className="progress-pct">{sadaMax>0?Math.round((sadaStep/sadaMax)*100):0}%</span>
              </div>
              <div className="agent-statuses">
                {baselineAgents.slice(0, numAgents).map(a => {
                  const baseDone = a.done && (a.completionStep??-1) <= baseStep;
                  const sA = sadaAgents.find(s=>s.id===a.id);
                  const sadaDone = sA?.done && (sA.completionStep??-1) <= sadaStep;
                  return (
                    <div key={a.id} className="agent-status-row">
                      <span className="agent-dot-mini" style={{backgroundColor:a.color}} />
                      <span>Agent {a.id}</span>
                      <span className={`badge-status ${baseDone?'done':'pending'}`}>{baseDone?'✓':'…'}</span>
                      <span className={`badge-status ${sadaDone?'done':'pending'}`}>{sadaDone?'✓':'…'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Replay Card */}
            <div className="sidebar-card replay-card">
              <div className="sidebar-title">💾 Replay System</div>
              <p className="field-hint" style={{marginBottom:'0.75rem'}}>
                Export the full frame-by-frame simulation log or import a saved replay.
              </p>
              <div className="replay-btn-group">
                <button className="btn-secondary replay-btn" onClick={handleSaveBaseReplay}>
                  ⬇ Save Baseline
                </button>
                <button className="btn-secondary replay-btn" onClick={handleSaveSadaReplay}>
                  ⬇ Save SADA
                </button>
              </div>
              <button className="btn-secondary" style={{width:'100%', marginTop:'0.5rem'}} onClick={handleLoadReplay}>
                📂 Load Replay File
              </button>
              {replayStatus && (
                <p className={`replay-status${replayStatus.startsWith('✓') ? ' success' : ''}`}>
                  {replayStatus}
                </p>
              )}
            </div>
          </div>

          {/* ── Main Simulation Area ─────────────────────────────── */}
          <div className="sim-main">
            {/* Playback Controls Bar */}
            <div className="controls-bar">
              <button
                className={`ctrl-btn ${isPlaying?'pause':'play'}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                className="ctrl-btn reset"
                onClick={() => { setBaseStep(0); setSadaStep(0); setIsPlaying(false); }}
              >
                ⟳ Reset
              </button>
              <div className="speed-row">
                <span>Speed</span>
                <input
                  type="range" min="50" max="500" step="25" value={550-speed}
                  onChange={e => setSpeed(550-parseInt(e.target.value))}
                  style={{direction:'rtl', width:'80px'}}
                />
              </div>
              <div className="ctrl-bar-right">
                <span className="step-lbl">
                  B:<strong>{baseStep}</strong>/{baseMax} &nbsp; S:<strong>{sadaStep}</strong>/{sadaMax}
                </span>
                {baseStep >= baseMax && sadaStep >= sadaMax && (
                  <span className="done-inline-badge">✓ Complete</span>
                )}
              </div>
            </div>

            {/* Grids Side by Side */}
            <div className="grids-row">
              <div className="sim-panel baseline-panel">
                <div className="panel-header">
                  <span className="panel-title">Baseline (Greedy)</span>
                  <span className="panel-badge base-badge">NO STABILITY COST</span>
                  {baseStep >= baseMax && <span className="done-chip">✓ DONE</span>}
                </div>
                <SimGrid
                  agents={activeAgents}
                  grid={grid}
                  step={baseStep}
                  domainMode={domainMode}
                  showTrails={showTrails}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={setSelectedAgentId}
                  onCellMouseDown={handleCellDown}
                  onCellMouseEnter={handleCellEnter}
                  heatmap={baseHeatmap}
                  heatmapMax={baseHeatmapMax}
                />
                <div className="inline-stats">
                  <span>Flips: <strong className="danger">{baseFlipCount}</strong></span>
                  <span>Smooth: <strong>{baseStats.smoothness.toFixed(0)}%</strong></span>
                  <span>Energy: <strong>{baseStats.energy} Wh</strong></span>
                </div>
              </div>

              <div className="vs-divider">VS</div>

              <div className="sim-panel sada-panel">
                <div className="panel-header">
                  <span className="panel-title">SADA (Stability-Aware)</span>
                  <span className="panel-badge sada-badge">β = {beta.toFixed(1)}</span>
                  {sadaStep >= sadaMax && <span className="done-chip">✓ DONE</span>}
                </div>
                <SimGrid
                  agents={activeSada}
                  grid={grid}
                  step={sadaStep}
                  domainMode={domainMode}
                  showTrails={showTrails}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={setSelectedAgentId}
                  onCellMouseDown={handleCellDown}
                  onCellMouseEnter={handleCellEnter}
                  heatmap={sadaHeatmap}
                  heatmapMax={sadaHeatmapMax}
                />
                <div className="inline-stats">
                  <span>Flips: <strong className="success">{sadaFlipCount}</strong></span>
                  <span>Smooth: <strong className="success">{sadaStats.smoothness.toFixed(0)}%</strong></span>
                  <span>Energy: <strong className="success">{sadaStats.energy} Wh</strong></span>
                </div>
              </div>
            </div>

            {/* Time Travel Debugger */}
            <TimelineDebugger
              baseStep={baseStep}
              sadaStep={sadaStep}
              globalMax={globalMax}
              baseMax={baseMax}
              sadaMax={sadaMax}
              onScrub={handleScrub}
              onStepForward={handleStepForward}
              onStepBack={handleStepBack}
              selectedAgentId={selectedAgentId}
              baselineAgents={activeAgents}
              sadaAgents={activeSada}
              baselineFrames={baselineFrames}
              sadaFrames={sadaFrames}
            />

            {/* Decision Cost Inspector */}
            <div className="inspector-card">
              <div className="inspector-title">🔍 Agent Decision Cost Inspector</div>
              <Inspector
                selectedAgentId={selectedAgentId}
                baselineAgents={baselineAgents}
                sadaAgents={sadaAgents}
                grid={grid}
                step={Math.min(baseStep, sadaStep)}
                beta={beta}
                historyK={historyK}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SECTION 2: ANALYTICS
      ══════════════════════════════════════════════════════════ */}
      {activeSection === 'analytics' && (
        <div className="analytics-layout" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <StatsPanel baseStats={baseStats} sadaStats={sadaStats} domainMode={domainMode} />
          <BatchSandbox beta={beta} historyK={historyK} numAgents={numAgents} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SECTION 3: RESULTS ANALYSIS
      ══════════════════════════════════════════════════════════ */}
      {activeSection === 'results' && <ResultsAnalyzer />}

      {/* ══════════════════════════════════════════════════════════
          SECTION 4: ALGORITHM EXPLAINER
      ══════════════════════════════════════════════════════════ */}
      {activeSection === 'explainer' && (
        <div className="explainer-section">
          <div className="explainer-card">
            <h2>What is Decision Jitter?</h2>
            <p>In standard multi-agent pathfinding, each agent greedily picks the action with the lowest <em>distance + collision</em> cost at each step. When two agents occupy adjacent cells, their local cost landscapes become nearly symmetric — causing each agent to flip between UP and DOWN (or LEFT and RIGHT) repeatedly. This oscillation is called <strong>decision jitter</strong>.</p>
            <div className="formula-box">
              <span className="formula-label">Baseline Cost</span>
              <code>C(a) = dist(next, goal) + col_penalty</code>
            </div>
          </div>

          <div className="explainer-card">
            <h2>How SADA Fixes It</h2>
            <p>SADA appends a <strong>stability term</strong> to the cost function. It tracks the last <em>K</em> actions and computes a <em>flip count</em> — the number of direction changes. Any action that would increase the flip count is penalised by <em>β × flips</em>. This makes it more expensive to reverse direction than to wait or slightly detour.</p>
            <div className="formula-box sada-formula">
              <span className="formula-label sada-label-f">SADA Cost</span>
              <code>C(a) = dist(next, goal) + col_penalty + <span className="highlight-term">β × flip_count(a, history)</span></code>
            </div>
          </div>

          <div className="explainer-steps">
            <div className="step-card">
              <div className="step-num">1</div>
              <div>
                <strong>History Tracking</strong>
                <p>Each agent maintains a sliding window of its last K actions using a bounded deque.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div>
                <strong>Flip Count Evaluation</strong>
                <p>For each candidate action, SADA simulates appending it to history and counts consecutive direction changes.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div>
                <strong>Stability Penalty Applied</strong>
                <p>The flip count is multiplied by β and added to the total cost, discouraging erratic switching.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">4</div>
              <div>
                <strong>Smooth Trajectories</strong>
                <p>Agents naturally prefer consistent headings, resolving congestion through orderly yielding rather than oscillation.</p>
              </div>
            </div>
          </div>

          <div className="explainer-card">
            <h2>Trade-off: Stability vs Optimality</h2>
            <p>Higher β values produce smoother paths but can slightly increase total path length (agents detour rather than wait and jitter). The synopsis target is <strong>&lt;15% path overhead</strong> while achieving <strong>&gt;90% success rate</strong> — both achievable in the default β=8 configuration. Use the Live Simulation tab to tune β and observe the trade-off in real time.</p>
          </div>
        </div>
      )}
    </div>
  );
}
