import { type Agent, type Position } from './Simulation';

interface InspectorProps {
  selectedAgentId: number | null;
  baselineAgents: Agent[];
  sadaAgents: Agent[];
  grid: number[][];
  step: number;
  beta: number;
  historyK: number;
}

const GRID_SIZE = 20;
const MOVES = [
  { name: 'UP', dx: -1, dy: 0 },
  { name: 'DOWN', dx: 1, dy: 0 },
  { name: 'LEFT', dx: 0, dy: -1 },
  { name: 'RIGHT', dx: 0, dy: 1 },
  { name: 'WAIT', dx: 0, dy: 0 },
];

function reconstructHistory(agent: Agent, step: number, K: number): string[] {
  const hist: string[] = [];
  for (let i = 1; i <= step && i < agent.path.length; i++) {
    const prev = agent.path[i - 1], curr = agent.path[i];
    if (curr[0] === prev[0] - 1) hist.push('UP');
    else if (curr[0] === prev[0] + 1) hist.push('DOWN');
    else if (curr[1] === prev[1] - 1) hist.push('LEFT');
    else if (curr[1] === prev[1] + 1) hist.push('RIGHT');
    else hist.push('WAIT');
  }
  return hist.slice(-K);
}

function flipCount(history: string[], newAction: string): number {
  if (!history.length) return 0;
  const h = [...history, newAction];
  return h.slice(1).filter((a, i) => a !== h[i]).length;
}

function getCosts(agent: Agent, agents: Agent[], grid: number[][], step: number, beta: number, K: number, isSada: boolean) {
  const currentPos = agent.path[Math.min(step, agent.path.length - 1)];
  const occupied = new Set(
    agents.filter(a => a.id !== agent.id).map(a => {
      const p = a.path[Math.min(step, a.path.length - 1)];
      return `${p[0]},${p[1]}`;
    })
  );
  const history = reconstructHistory(agent, step, K);
  const chosenNext = agent.path[Math.min(step + 1, agent.path.length - 1)];

  return MOVES.map(move => {
    const next: Position = [currentPos[0] + move.dx, currentPos[1] + move.dy];
    const oob = next[0] < 0 || next[0] >= GRID_SIZE || next[1] < 0 || next[1] >= GRID_SIZE;
    const blocked = !oob && grid[next[0]][next[1]] === 1;
    if (oob || blocked) return { name: move.name, invalid: true, isChosen: false };

    const dist = Math.abs(next[0] - agent.goal[0]) + Math.abs(next[1] - agent.goal[1]);
    const col = occupied.has(`${next[0]},${next[1]}`) ? 50 : 0;
    const wait = move.name === 'WAIT' ? 2 : 0;
    const stab = isSada ? beta * flipCount(history, move.name) : 0;
    const total = dist + col + wait + stab;
    const isChosen = next[0] === chosenNext[0] && next[1] === chosenNext[1];
    return { name: move.name, dist, col, wait, stab, total, invalid: false, isChosen };
  });
}

export default function Inspector({ selectedAgentId, baselineAgents, sadaAgents, grid, step, beta, historyK }: InspectorProps) {
  const baseAgent = baselineAgents.find(a => a.id === selectedAgentId);
  const sadaAgent = sadaAgents.find(a => a.id === selectedAgentId);

  if (!baseAgent || !sadaAgent) {
    return (
      <div className="inspector-empty">
        <div className="inspector-icon">🎯</div>
        <p>Click any agent on the grid to inspect its real-time decision cost matrix</p>
        <p className="inspector-sub">See <em>why</em> SADA picks a different action than Baseline</p>
      </div>
    );
  }

  const baseCosts = getCosts(baseAgent, baselineAgents, grid, step, beta, historyK, false);
  const sadaCosts = getCosts(sadaAgent, sadaAgents, grid, step, beta, historyK, true);
  const pos = baseAgent.path[Math.min(step, baseAgent.path.length - 1)];

  return (
    <div className="inspector-content">
      <div className="inspector-header">
        <span className="inspector-agent-badge" style={{ backgroundColor: baseAgent.color }}>
          Agent #{baseAgent.id}
        </span>
        <span>Position ({pos[0]}, {pos[1]})</span>
        <span>Goal ({baseAgent.goal[0]}, {baseAgent.goal[1]})</span>
        <span>Flips — Base: <strong className="danger">{baseAgent.flips}</strong> &nbsp; SADA: <strong className="success">{sadaAgent.flips}</strong></span>
      </div>

      <div className="inspector-tables">
        <div className="inspector-table-wrap">
          <div className="inspector-table-title baseline-title">Baseline Cost Function</div>
          <table className="cost-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Dist</th>
                <th>Col</th>
                <th>Wait</th>
                <th>Stab</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {baseCosts.map(r => (
                <tr key={r.name} className={r.invalid ? 'row-invalid' : r.isChosen ? 'row-chosen' : ''}>
                  <td><strong>{r.name}</strong>{r.isChosen ? ' ✔' : ''}</td>
                  {r.invalid ? <><td colSpan={5} style={{ textAlign: 'center', opacity: 0.4 }}>— blocked —</td></> :
                    <>
                      <td>{r.dist}</td>
                      <td>{r.col}</td>
                      <td>{r.wait}</td>
                      <td>0</td>
                      <td className="total-cell">{r.total}</td>
                    </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="inspector-table-wrap">
          <div className="inspector-table-title sada-title">SADA Cost Function</div>
          <table className="cost-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Dist</th>
                <th>Col</th>
                <th>Wait</th>
                <th>β·flip</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sadaCosts.map(r => (
                <tr key={r.name} className={r.invalid ? 'row-invalid' : r.isChosen ? 'row-chosen' : ''}>
                  <td><strong>{r.name}</strong>{r.isChosen ? ' ✔' : ''}</td>
                  {r.invalid ? <><td colSpan={5} style={{ textAlign: 'center', opacity: 0.4 }}>— blocked —</td></> :
                    <>
                      <td>{r.dist}</td>
                      <td>{r.col}</td>
                      <td>{r.wait}</td>
                      <td className={r.stab! > 0 ? 'stab-cell' : ''}>{r.stab}</td>
                      <td className="total-cell">{r.total}</td>
                    </>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="inspector-note">Purple = stability penalty prevents direction flip</p>
        </div>
      </div>
    </div>
  );
}
