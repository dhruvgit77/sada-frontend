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
  heatmap?: number[][];
  showHeatmap?: boolean;
}

export default function SimGrid({
  agents, grid, step, domainMode,
  showTrails, selectedAgentId, onSelectAgent,
  onCellMouseDown, onCellMouseEnter,
  heatmap, showHeatmap
}: SimGridProps) {

  return (
    <div className="grid-container">
      {grid.map((row, rIdx) => (
        <div key={rIdx} className="grid-row">
          {row.map((cell, cIdx) => {
            const isObstacle = cell === 1;
            const agentsHere = agents.filter(a => {
              const pos = a.path[Math.min(step, a.path.length - 1)];
              return pos[0] === rIdx && pos[1] === cIdx;
            });
            const goalsHere = agents.filter(a =>
              a.goal[0] === rIdx && a.goal[1] === cIdx
            );

            // Trail cells
            const trailAgents = showTrails && !isObstacle && agentsHere.length === 0
              ? agents.filter(a =>
                  a.path.slice(0, step + 1).some(p => p[0] === rIdx && p[1] === cIdx)
                )
              : [];

            const heatVal = showHeatmap && heatmap ? heatmap[rIdx][cIdx] : 0;
            const cellStyle = heatVal > 0 ? {
              backgroundColor: `rgba(239, 68, 68, ${Math.min(heatVal * 0.25, 0.85)})`,
              boxShadow: `inset 0 0 6px rgba(239, 68, 68, ${Math.min(heatVal * 0.3, 0.9)})`
            } : undefined;

            return (
              <div
                key={cIdx}
                className={`grid-cell${isObstacle ? ' obstacle' : ''}`}
                onMouseDown={() => onCellMouseDown(rIdx, cIdx)}
                onMouseEnter={() => onCellMouseEnter(rIdx, cIdx)}
                style={cellStyle}
              >
                {/* Heatmap value badge */}
                {heatVal > 0 && <span className="heatmap-val-badge">{heatVal}</span>}
                {/* Obstacle skin */}
                {isObstacle && domainMode === 'warehouse' && <span className="cell-emoji">🗄️</span>}
                {isObstacle && domainMode === 'evacuation' && <span className="cell-emoji">🧱</span>}

                {/* Goal skin */}
                {!isObstacle && goalsHere.map(g => (
                  <div
                    key={g.id}
                    className="goal-wrapper"
                    style={{
                      borderColor: g.color,
                      boxShadow: `0 0 8px ${g.color}55`
                    }}
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

                {/* Trail dots */}
                {trailAgents.length > 0 && (
                  <div className="trail-dot-overlay">
                    {trailAgents.map(a => (
                      <div key={a.id} className="trail-dot" style={{ backgroundColor: a.color }} />
                    ))}
                  </div>
                )}

                {/* Agent skin */}
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
                          : 'none'
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
}
