import { useState, useEffect } from 'react';
import './index.css';
import { simulate, type AgentConfig } from './Simulation';
import SimGrid from './SimGrid';
import StatsPanel, { computeStats } from './StatsPanel';
import Inspector from './Inspector';
import BatchSandbox from './BatchSandbox';
import ResultsAnalyzer from './ResultsAnalyzer';

const GRID_SIZE = 20;
type DomainMode = 'abstract' | 'warehouse' | 'evacuation';
const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

function makeEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

/* ── Preset Environments ───────────────────────────────────────────── */
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

/* ── App ───────────────────────────────────────────────────────────── */
export default function App() {
  const [activePresetId, setActivePresetId] = useState('corridor');
  const [grid, setGrid] = useState(() => PRESETS[1].grid.map(r => [...r]));
  const [agentsConfig, setAgentsConfig] = useState<AgentConfig[]>(PRESETS[1].agents);

  const [beta, setBeta] = useState(8.0);
  const [historyK, setHistoryK] = useState(5);
  const [numAgents, setNumAgents] = useState(4);
  const [speed, setSpeed] = useState(150);
  const [domainMode, setDomainMode] = useState<DomainMode>('warehouse');
  const [showTrails, setShowTrails] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'sim'|'analytics'|'results'|'explainer'>('sim');

  const [baselineAgents, setBaselineAgents] = useState(simulate(grid, PRESETS[1].agents.slice(0,4), false, 200));
  const [sadaAgents, setSadaAgents]         = useState(simulate(grid, PRESETS[1].agents.slice(0,4), true,  200));

  const computeHeatmap = (agents: any[]) => {
    const hm = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (const agent of agents) {
      let prevAction = '';
      for (let i = 0; i < agent.path.length; i++) {
        const pos = agent.path[i];
        let action = 'WAIT';
        if (i > 0) {
          const prev = agent.path[i - 1];
          const dx = pos[0] - prev[0];
          const dy = pos[1] - prev[1];
          if (dx === -1 && dy === 0) action = 'UP';
          else if (dx === 1 && dy === 0) action = 'DOWN';
          else if (dx === 0 && dy === -1) action = 'LEFT';
          else if (dx === 0 && dy === 1) action = 'RIGHT';
        }
        if (i > 1 && action !== prevAction && action !== 'WAIT' && prevAction !== 'WAIT') {
          const flipPos = agent.path[i - 1];
          if (flipPos && flipPos[0] >= 0 && flipPos[0] < GRID_SIZE && flipPos[1] >= 0 && flipPos[1] < GRID_SIZE) {
            hm[flipPos[0]][flipPos[1]] += 1;
          }
        }
        prevAction = action;
      }
    }
    return hm;
  };

  const baseHeatmap = computeHeatmap(baselineAgents);
  const sadaHeatmap = computeHeatmap(sadaAgents);

  // INDEPENDENT step counters — each model runs until IT is done
  const [baseStep, setBaseStep] = useState(0);
  const [sadaStep, setSadaStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawType, setDrawType] = useState<number>(1);

  /* run simulation */
  const runSim = (g: number[][], cfg: AgentConfig[]) => {
    const active = cfg.slice(0, numAgents).map(c => ({ ...c, beta, K: historyK }));
    setBaselineAgents(simulate(g, active, false, 200));
    setSadaAgents(simulate(g, active, true, 200));
    setBaseStep(0); setSadaStep(0); setIsPlaying(false);
  };

  useEffect(() => { runSim(grid, agentsConfig); }, []);

  /* animation — each step counter stops independently */
  useEffect(() => {
    if (!isPlaying) return;
    const baseMax = baselineAgents.length ? baselineAgents[0].path.length - 1 : 0;
    const sadaMax  = sadaAgents.length    ? sadaAgents[0].path.length - 1    : 0;
    if (baseStep >= baseMax && sadaStep >= sadaMax) { setIsPlaying(false); return; }
    const id = setInterval(() => {
      setBaseStep(s => s < baseMax ? s + 1 : s);
      setSadaStep(s => s < sadaMax ? s + 1 : s);
    }, speed);
    return () => clearInterval(id);
  }, [isPlaying, speed, baseStep, sadaStep, baselineAgents, sadaAgents]);

  /* preset load */
  const loadPreset = (pid: string) => {
    const p = PRESETS.find(p => p.id === pid)!;
    setActivePresetId(pid);
    const g = p.grid.map(r => [...r]);
    setGrid(g);
    setAgentsConfig(p.agents);
    setNumAgents(Math.min(p.agents.length, numAgents));
    runSim(g, p.agents);
  };

  /* map painting */
  const handleCellDown = (r: number, c: number) => {
    const blocked = agentsConfig.some(a =>
      (a.start[0]===r&&a.start[1]===c)||(a.goal[0]===r&&a.goal[1]===c)
    );
    if (blocked) return;
    const t = grid[r][c]===1 ? 0 : 1;
    setDrawType(t);
    setIsDrawing(true);
    paintCell(r, c, t);
  };
  const handleCellEnter = (r: number, c: number) => {
    if (!isDrawing) return;
    paintCell(r, c, drawType);
  };
  const paintCell = (r: number, c: number, t: number) => {
    const blocked = agentsConfig.some(a =>
      (a.start[0]===r&&a.start[1]===c)||(a.goal[0]===r&&a.goal[1]===c)
    );
    if (blocked) return;
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = t;
      return next;
    });
  };
  const handleMouseUp = () => {
    if (isDrawing) { setIsDrawing(false); runSim(grid, agentsConfig); }
  };

  const baseStats = computeStats(baselineAgents);
  const sadaStats = computeStats(sadaAgents);
  const baseMax = baselineAgents.length ? baselineAgents[0].path.length - 1 : 0;
  const sadaMax = sadaAgents.length    ? sadaAgents[0].path.length - 1    : 0;
  const globalMax = Math.max(baseMax, sadaMax);

  /* scrubber syncs both */
  const handleScrub = (v: number) => {
    setSadaStep(Math.min(v, sadaMax));
    setBaseStep(Math.min(v, baseMax));
    setIsPlaying(false);
  };

  return (
    <div className="app" onMouseUp={handleMouseUp}>

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-left">
          <div className="hero-logo">SADA</div>
          <div>
            <h1 className="hero-title">Stability-Aware Decision Algorithm</h1>
            <p className="hero-sub">Solving multi-agent congestion through temporal stability — applied to <strong>{domainMode === 'warehouse' ? 'Warehouse Logistics' : domainMode === 'evacuation' ? 'Emergency Evacuation' : 'Abstract Grid'}</strong></p>
          </div>
        </div>

        <div className="domain-tabs">
          {(['abstract','warehouse','evacuation'] as DomainMode[]).map(d => (
            <button key={d} className={`domain-tab${domainMode===d?' active':''}`} onClick={() => setDomainMode(d)}>
              {d==='abstract'?'📐 Grid':d==='warehouse'?'🤖 Warehouse':'🚪 Evacuation'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Problem Banner (contextual) ──────────────────────────── */}
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
            <p>Crowd simulation studies show that indecisive agents (those constantly changing direction) block corridors and reduce safe-egress throughput by up to 40%. SADA enforces decisive, smooth movement even under congestion.</p>
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

      {/* ── Nav tabs ────────────────────────────────────────────── */}
      <nav className="section-nav">
        {(['sim','analytics','results','explainer'] as const).map(s => (
          <button key={s} className={`nav-btn${activeSection===s?' active':''}`} onClick={() => setActiveSection(s)}>
            {s==='sim'?'🎮 Live Simulation':s==='analytics'?'📊 Performance Analytics':s==='results'?'📈 Results Analysis':'🧠 Algorithm Explainer'}
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1: LIVE SIMULATION
      ══════════════════════════════════════════════════════════ */}
      {activeSection === 'sim' && (
        <div className="sim-section">
          <div className="sidebar">
            <div className="sidebar-card">
              <div className="sidebar-title">⚙️ Parameters</div>

              <label className="field-label">Environment</label>
              <select className="field-select" value={activePresetId} onChange={e => loadPreset(e.target.value)}>
                {PRESETS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
              <p className="field-hint">{PRESETS.find(p=>p.id===activePresetId)?.description}</p>

              <div className="divider" />

              <div className="slider-row">
                <label>Stability Penalty β</label>
                <span className="slider-val">{beta.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="30" step="0.5" value={beta}
                onChange={e => setBeta(parseFloat(e.target.value))} />
              <p className="field-hint">Higher = stronger jitter suppression (may deadlock at extremes)</p>

              <div className="slider-row">
                <label>History Window K</label>
                <span className="slider-val">{historyK}</span>
              </div>
              <input type="range" min="2" max="15" step="1" value={historyK}
                onChange={e => setHistoryK(parseInt(e.target.value))} />

              <div className="slider-row">
                <label>Agent Count</label>
                <span className="slider-val">{numAgents}</span>
              </div>
              <input type="range" min="1" max={agentsConfig.length} step="1" value={numAgents}
                onChange={e => setNumAgents(parseInt(e.target.value))} />

              <div className="divider" />

              <label className="toggle-label">
                <input type="checkbox" checked={showTrails} onChange={e => setShowTrails(e.target.checked)} />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                Show Path Trails
              </label>

              <label className="toggle-label" style={{ marginTop: '0.5rem' }}>
                <input type="checkbox" checked={showHeatmap} onChange={e => setShowHeatmap(e.target.checked)} />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                Show Jitter Heatmap
              </label>

              <button className="btn-primary" onClick={() => runSim(grid, agentsConfig)}>
                ↺ Recalculate
              </button>
              <p className="field-hint" style={{marginTop:'0.5rem'}}>
                💡 <strong>Map Editor:</strong> Click/drag on grids to paint walls
              </p>
            </div>

            {/* Live completion status */}
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
                {baselineAgents.slice(0,numAgents).map(a => {
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
          </div>

          <div className="sim-main">
            {/* Playback controls */}
            <div className="controls-bar">
              <button className={`ctrl-btn ${isPlaying?'pause':'play'}`} onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button className="ctrl-btn reset" onClick={() => { setBaseStep(0); setSadaStep(0); setIsPlaying(false); }}>⟳ Reset</button>
              <div className="speed-row">
                <span>Speed</span>
                <input type="range" min="50" max="500" step="25" value={550-speed}
                  onChange={e => setSpeed(550-parseInt(e.target.value))} style={{direction:'rtl',width:'80px'}} />
              </div>
              <div className="scrubber-row">
                <span>Scrub</span>
                <input type="range" min="0" max={globalMax} value={Math.max(baseStep, sadaStep)}
                  onChange={e => handleScrub(parseInt(e.target.value))} className="scrubber" />
                <span className="step-lbl">
                  B:<strong>{baseStep}</strong>/{baseMax} &nbsp; S:<strong>{sadaStep}</strong>/{sadaMax}
                </span>
              </div>
            </div>

            {/* Grids side by side */}
            <div className="grids-row">
              <div className="sim-panel baseline-panel">
                <div className="panel-header">
                  <span className="panel-title">Baseline (Greedy)</span>
                  <span className="panel-badge base-badge">No Stability Cost</span>
                  {baseStep >= baseMax && <span className="done-chip">✓ DONE</span>}
                </div>
                <SimGrid
                  agents={baselineAgents.slice(0,numAgents)}
                  grid={grid}
                  step={baseStep}
                  domainMode={domainMode}
                  showTrails={showTrails}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={setSelectedAgentId}
                  onCellMouseDown={handleCellDown}
                  onCellMouseEnter={handleCellEnter}
                  heatmap={baseHeatmap}
                  showHeatmap={showHeatmap}
                />
                <div className="inline-stats">
                  <span>Flips: <strong className="danger">{baselineAgents.slice(0,numAgents).reduce((s,a)=>s+a.flips,0)}</strong></span>
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
                  agents={sadaAgents.slice(0,numAgents)}
                  grid={grid}
                  step={sadaStep}
                  domainMode={domainMode}
                  showTrails={showTrails}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={setSelectedAgentId}
                  onCellMouseDown={handleCellDown}
                  onCellMouseEnter={handleCellEnter}
                  heatmap={sadaHeatmap}
                  showHeatmap={showHeatmap}
                />
                <div className="inline-stats">
                  <span>Flips: <strong className="success">{sadaAgents.slice(0,numAgents).reduce((s,a)=>s+a.flips,0)}</strong></span>
                  <span>Smooth: <strong className="success">{sadaStats.smoothness.toFixed(0)}%</strong></span>
                  <span>Energy: <strong className="success">{sadaStats.energy} Wh</strong></span>
                </div>
              </div>
            </div>

            {/* Inspector */}
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
      {activeSection === 'results' && (
        <ResultsAnalyzer />
      )}

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
