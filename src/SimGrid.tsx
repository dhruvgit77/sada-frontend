import React, { useMemo } from 'react';
import { type Agent } from './Simulation';

type DomainMode = 'abstract' | 'warehouse' | 'evacuation';

interface SimGridProps {
  agents: Agent[];
  grid: number[][];
  step: number;
  domainMode: DomainMode;
  showTrails: boolean;
  selectedAgentId: number | null;
  onSelectAgent: (id: number) => void;
  onCellMouseDown: (r: number, c: number) => void;
  onCellMouseEnter: (r: number, c: number) => void;
  heatmap?: number[][] | null;
  heatmapMax?: number;
}

function heatColor(normalized: number, alpha: number): string {
  const n = Math.max(0, Math.min(1, normalized));
  if (n <= 0.5) {
    const t = n * 2;
    const r = Math.round(96 + t * (251 - 96));
    const g = Math.round(165 + t * (191 - 165));
    const b = Math.round(250 - t * 250);
    return `rgba(${r},${g},${b},${alpha})`;
  } else {
    const t = (n - 0.5) * 2;
    const r = Math.round(251 - t * 12);
    const g = Math.round(191 - t * 191);
    const b = 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }
}

const SimGrid = React.memo(function SimGrid({
  agents, grid, step, domainMode,
  showTrails, selectedAgentId, onSelectAgent,
  onCellMouseDown, onCellMouseEnter,
  heatmap, heatmapMax = 1,
}: SimGridProps) {

  const agentPositions = useMemo(() =>
    agents.map(a => a.path[Math.min(step, a.path.length - 1)]),
    [agents, step]
  );

  const trailSets = useMemo(() => {
    if (!showTrails) return agents.map(() => new Set<string>());
    return agents.map(a => {
      const s = new Set<string>();
      for (let i = 0; i <= step && i < a.path.length; i++) {
        s.add(`${a.path[i][0]},${a.path[i][1]}`);
      }
      return s;
    });
  }, [agents, step, showTrails]);

  return (
    <div className="grid-container">
      {grid.map((row, rIdx) => (
        <div key={rIdx} className="grid-row">
          {row.map((cell, cIdx) => {
            const isObstacle = cell === 1;

            const agentsHere = agents.filter((_, i) => {
              const pos = agentPositions[i];
              return pos[0] === rIdx && pos[1] === cIdx;
            });

            const goalsHere = agents.filter(a =>
              a.goal[0] === rIdx && a.goal[1] === cIdx
            );

            const trailAgents = showTrails && !isObstacle && agentsHere.length === 0
              ? agents.filter((_, i) => trailSets[i].has(`${rIdx},${cIdx}`))
              : [];

            const heatVal = heatmap ? heatmap[rIdx][cIdx] : 0;
            const normalized = heatmapMax > 0 ? heatVal / heatmapMax : 0;
            const cellStyle = heatVal > 0 ? {
              backgroundColor: heatColor(normalized, Math.max(0.15, normalized * 0.85)),
              boxShadow: `inset 0 0 6px ${heatColor(normalized, Math.min(normalized * 0.9, 0.9))}`,
            } : undefined;

            return (
              <div
                key={cIdx}
                className={`grid-cell${isObstacle ? ' obstacle' : ''}`}
                onMouseDown={() => onCellMouseDown(rIdx, cIdx)}
                onMouseEnter={() => onCellMouseEnter(rIdx, cIdx)}
                style={cellStyle}
              >
                {heatVal > 0 && <span className="heatmap-val-badge">{heatVal}</span>}

                {isObstacle && domainMode === 'warehouse' && <span className="cell-emoji">🗄️</span>}
                {isObstacle && domainMode === 'evacuation' && <span className="cell-emoji">🧱</span>}

                {!isObstacle && goalsHere.map(g => (
                  <div
                    key={g.id}
                    className="goal-wrapper"
                    style={{ borderColor: g.color, boxShadow: `0 0 8px ${g.color}55` }}
                  >
                    {domainMode === 'warehouse' ? (
                      <span className="goal-emoji">🚛</span>
                    ) : domainMode === 'evacuation' ? (
                      <span className="goal-emoji">🚪</span>
                    ) : (
                      <div className="goal-marker-inner" style={{ backgroundColor: g.color }} />
                    )}
                  </div>
                ))}

                {trailAgents.length > 0 && (
                  <div className="trail-dot-overlay">
                    {trailAgents.map(a => (
                      <div key={a.id} className="trail-dot" style={{ backgroundColor: a.color }} />
                    ))}
                  </div>
                )}

                {agentsHere.map((a, idx) => {
                  const isSelected = selectedAgentId === a.id;
                  const isDone = a.done && (a.completionStep ?? -1) <= step;
                  const skin = domainMode === 'warehouse' ? '🤖' : domainMode === 'evacuation' ? '🚶' : null;
                  return (
                    <div
                      key={a.id}
                      className={`agent-dot${isSelected ? ' selected' : ''}${isDone ? ' agent-done' : ''}`}
                      style={{
                        backgroundColor: a.color,
                        boxShadow: `0 0 10px ${a.color}aa`,
                        transform: agentsHere.length > 1
                          ? `translate(${(idx - (agentsHere.length - 1) / 2) * 5}px,${(idx - (agentsHere.length - 1) / 2) * 5}px)`
                          : 'none',
                      }}
                      onClick={e => { e.stopPropagation(); onSelectAgent(a.id); }}
                    >
                      {skin && <span className="agent-emoji">{skin}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

export default SimGrid;
