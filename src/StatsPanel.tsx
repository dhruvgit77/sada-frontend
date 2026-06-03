import { type Agent } from './Simulation';

export interface AdvancedStats {
  totalFlips: number;
  successRate: number;
  avgPathLen: number;
  smoothness: number;
  energy: number;
  avgCompletionStep: number;
}

export function computeStats(agents: Agent[]): AdvancedStats {
  if (!agents.length) return { totalFlips: 0, successRate: 0, avgPathLen: 0, smoothness: 0, energy: 0, avgCompletionStep: 0 };

  const totalFlips = agents.reduce((s, a) => s + a.flips, 0);
  const successRate = agents.filter(a => a.done).length / agents.length * 100;
  const avgPathLen = agents.reduce((s, a) => s + a.path.length, 0) / agents.length;

  // Smoothness: % of steps where heading is maintained
  const smoothnessList = agents.map(a => {
    if (a.path.length < 2) return 100;
    const nonFlips = Math.max(0, (a.path.length - 1) - a.flips);
    return (nonFlips / (a.path.length - 1)) * 100;
  });
  const smoothness = smoothnessList.reduce((s, v) => s + v, 0) / agents.length;

  // Energy: moves * 5Wh + flips * 25Wh (each flip = motor stress)
  const energy = agents.reduce((s, a) => s + (a.path.length * 5 + a.flips * 25), 0);

  // Average completion step
  const done = agents.filter(a => a.done && (a.completionStep ?? -1) >= 0);
  const avgCompletionStep = done.length
    ? done.reduce((s, a) => s + (a.completionStep ?? 0), 0) / done.length
    : -1;

  return { totalFlips, successRate, avgPathLen, smoothness, energy, avgCompletionStep };
}

interface StatCardProps {
  label: string;
  baseVal: string;
  sadaVal: string;
  better?: 'lower' | 'higher';
  basePct?: number;
  sadaPct?: number;
}

function StatCard({ label, baseVal, sadaVal, better = 'lower', basePct, sadaPct }: StatCardProps) {
  const parseNum = (val: string) => {
    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  };
  const nBase = parseNum(baseVal);
  const nSada = parseNum(sadaVal);
  
  let valueClass = '';
  if (nBase !== null && nSada !== null && nBase !== nSada) {
    const isSadaBetter = better === 'lower' ? nSada < nBase : nSada > nBase;
    valueClass = isSadaBetter ? 'text-success' : 'text-danger';
  }

  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row">
        <div className="stat-card-entry">
          <span className="model-tag base-tag">BASELINE</span>
          <span className="stat-card-val">{baseVal}</span>
        </div>
        <div className="stat-card-entry">
          <span className="model-tag sada-tag">SADA</span>
          <span className={`stat-card-val ${valueClass}`}>{sadaVal}</span>
        </div>
      </div>
      {basePct !== undefined && sadaPct !== undefined && (
        <div className="mini-bars">
          <div className="mini-bar-track">
            <div className="mini-bar base-bar" style={{ width: `${basePct}%` }} />
          </div>
          <div className="mini-bar-track">
            <div className="mini-bar sada-bar" style={{ width: `${sadaPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

interface StatsPanelProps {
  baseStats: AdvancedStats;
  sadaStats: AdvancedStats;
  domainMode: string;
}

export default function StatsPanel({ baseStats, sadaStats, domainMode }: StatsPanelProps) {
  const maxFlips = Math.max(baseStats.totalFlips, 1);
  const maxEnergy = Math.max(baseStats.energy, 1);
  const maxPath = Math.max(baseStats.avgPathLen, sadaStats.avgPathLen, 1);

  const flipRedPct = baseStats.totalFlips > 0
    ? Math.round(((baseStats.totalFlips - sadaStats.totalFlips) / baseStats.totalFlips) * 100)
    : 0;
  const energyRedPct = baseStats.energy > 0
    ? Math.round(((baseStats.energy - sadaStats.energy) / baseStats.energy) * 100)
    : 0;
  const smoothGain = Math.round(sadaStats.smoothness - baseStats.smoothness);

  return (
    <div className="stats-section">
      <h3 className="section-heading">📊 Performance Analytics</h3>

      {/* Highlight gains */}
      <div className="gains-row">
        <div className="gain-chip">
          <span className="gain-number">-{flipRedPct}%</span>
          <span className="gain-desc">Decision Jitter</span>
        </div>
        <div className="gain-chip">
          <span className="gain-number">-{energyRedPct}%</span>
          <span className="gain-desc">{domainMode === 'warehouse' ? 'Battery Usage' : 'Panic Index'}</span>
        </div>
        <div className="gain-chip">
          <span className="gain-number">+{smoothGain}%</span>
          <span className="gain-desc">Path Smoothness</span>
        </div>
      </div>

      <div className="stat-cards-grid">
        <StatCard
          label="Decision Flips (Jitter)"
          baseVal={String(baseStats.totalFlips)}
          sadaVal={String(sadaStats.totalFlips)}
          better="lower"
          basePct={(baseStats.totalFlips / maxFlips) * 100}
          sadaPct={(sadaStats.totalFlips / maxFlips) * 100}
        />
        <StatCard
          label={domainMode === 'warehouse' ? 'Total Energy (Wh)' : 'Panic Score'}
          baseVal={String(baseStats.energy)}
          sadaVal={String(sadaStats.energy)}
          better="lower"
          basePct={(baseStats.energy / maxEnergy) * 100}
          sadaPct={(sadaStats.energy / maxEnergy) * 100}
        />
        <StatCard
          label="Path Smoothness"
          baseVal={`${baseStats.smoothness.toFixed(0)}%`}
          sadaVal={`${sadaStats.smoothness.toFixed(0)}%`}
          better="higher"
          basePct={baseStats.smoothness}
          sadaPct={sadaStats.smoothness}
        />
        <StatCard
          label="Avg Path Length (steps)"
          baseVal={baseStats.avgPathLen.toFixed(1)}
          sadaVal={sadaStats.avgPathLen.toFixed(1)}
          better="lower"
          basePct={(baseStats.avgPathLen / maxPath) * 100}
          sadaPct={(sadaStats.avgPathLen / maxPath) * 100}
        />
        <StatCard
          label="Success Rate"
          baseVal={`${baseStats.successRate.toFixed(0)}%`}
          sadaVal={`${sadaStats.successRate.toFixed(0)}%`}
          better="higher"
          basePct={baseStats.successRate}
          sadaPct={sadaStats.successRate}
        />
        <StatCard
          label="Avg Completion Step"
          baseVal={baseStats.avgCompletionStep >= 0 ? baseStats.avgCompletionStep.toFixed(0) : 'N/A'}
          sadaVal={sadaStats.avgCompletionStep >= 0 ? sadaStats.avgCompletionStep.toFixed(0) : 'N/A'}
          better="lower"
        />
      </div>
    </div>
  );
}
