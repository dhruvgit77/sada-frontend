import React from 'react';
import type { Agent } from './Simulation';
import type { ReplayFrame } from './ReplayManager';

interface TimelineDebuggerProps {
  baseStep: number;
  sadaStep: number;
  globalMax: number;
  baseMax: number;
  sadaMax: number;
  onScrub: (v: number) => void;
  onStepForward: () => void;
  onStepBack: () => void;
  selectedAgentId: number | null;
  baselineAgents: Agent[];
  sadaAgents: Agent[];
  baselineFrames: ReplayFrame[];
  sadaFrames: ReplayFrame[];
}

function deriveAction(agent: Agent, step: number): string {
  if (step <= 0 || step >= agent.path.length) return '—';
  const prev = agent.path[step - 1];
  const curr = agent.path[step];
  const dx = curr[0] - prev[0];
  const dy = curr[1] - prev[1];
  if (dx === -1) return '↑ UP';
  if (dx === 1) return '↓ DOWN';
  if (dy === -1) return '← LEFT';
  if (dy === 1) return '→ RIGHT';
  return '⏸ WAIT';
}

const TimelineDebugger = React.memo(function TimelineDebugger({
  baseStep, sadaStep, globalMax, baseMax, sadaMax,
  onScrub, onStepForward, onStepBack,
  selectedAgentId, baselineAgents, sadaAgents,
  baselineFrames, sadaFrames,
}: TimelineDebuggerProps) {
  const currentStep = Math.max(baseStep, sadaStep);
  const baseAgent = selectedAgentId != null ? baselineAgents.find(a => a.id === selectedAgentId) : null;
  const sadaAgent = selectedAgentId != null ? sadaAgents.find(a => a.id === selectedAgentId) : null;
  const agentIdx = selectedAgentId != null ? baselineAgents.findIndex(a => a.id === selectedAgentId) : -1;

  const baseFrame = baselineFrames.length ? baselineFrames[Math.min(baseStep, baselineFrames.length - 1)] : null;
  const sadaFrame = sadaFrames.length ? sadaFrames[Math.min(sadaStep, sadaFrames.length - 1)] : null;

  const basePos = baseAgent ? baseAgent.path[Math.min(baseStep, baseAgent.path.length - 1)] : null;
  const sadaPos = sadaAgent ? sadaAgent.path[Math.min(sadaStep, sadaAgent.path.length - 1)] : null;

  const baseDone = baseAgent ? (baseAgent.done && (baseAgent.completionStep ?? -1) <= baseStep) : false;
  const sadaDone = sadaAgent ? (sadaAgent.done && (sadaAgent.completionStep ?? -1) <= sadaStep) : false;

  return (
    <div className="timeline-debugger">
      <div className="timeline-header">
        <span className="timeline-title">⏱ Time Travel Debugger</span>
        <div className="tl-step-display">
          <span className="tl-step-mono">
            Step <strong>{currentStep}</strong> / <strong>{globalMax}</strong>
          </span>
        </div>
      </div>

      <div className="tl-controls">
        <button
          className="tl-btn"
          onClick={onStepBack}
          disabled={currentStep === 0}
          title="Step back"
        >⏮</button>
        <input
          type="range" min="0" max={globalMax} value={currentStep}
          onChange={e => onScrub(parseInt(e.target.value))}
          className="tl-slider"
        />
        <button
          className="tl-btn"
          onClick={onStepForward}
          disabled={currentStep >= globalMax}
          title="Step forward"
        >⏭</button>
      </div>

      <div className="tl-track-labels">
        <span className="tl-track baseline-track">
          🔴 Baseline: <strong>{baseStep}</strong>/{baseMax}
        </span>
        <span className="tl-track sada-track">
          🟣 SADA: <strong>{sadaStep}</strong>/{sadaMax}
        </span>
      </div>

      {baseAgent && sadaAgent && agentIdx >= 0 ? (
        <div className="tl-agent-detail animate-fade">
          <div className="tl-agent-header">
            <span
              className="inspector-agent-badge"
              style={{ backgroundColor: baseAgent.color }}
            >
              Agent #{selectedAgentId}
            </span>
            <span className="tl-detail-label">Historical State — Step {currentStep}</span>
          </div>
          <div className="tl-agent-tables">
            <div className="tl-table-wrap">
              <div className="tl-table-title baseline-title">Baseline</div>
              <table className="tl-table">
                <tbody>
                  <tr>
                    <td>Position</td>
                    <td className="tl-val">[{basePos?.[0]}, {basePos?.[1]}]</td>
                  </tr>
                  <tr>
                    <td>Action</td>
                    <td className="tl-val">{deriveAction(baseAgent, baseStep)}</td>
                  </tr>
                  <tr>
                    <td>Total Flips</td>
                    <td className="tl-val danger">{baseAgent.flips}</td>
                  </tr>
                  <tr>
                    <td>Completion</td>
                    <td className="tl-val">{baseDone ? `✓ Step ${baseAgent.completionStep}` : '…pending'}</td>
                  </tr>
                  {baseFrame && agentIdx < baseFrame.agentActions.length && (
                    <tr>
                      <td>Frame Tag</td>
                      <td className="tl-val">{baseFrame.agentActions[agentIdx]}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="tl-table-wrap">
              <div className="tl-table-title sada-title">SADA</div>
              <table className="tl-table">
                <tbody>
                  <tr>
                    <td>Position</td>
                    <td className="tl-val">[{sadaPos?.[0]}, {sadaPos?.[1]}]</td>
                  </tr>
                  <tr>
                    <td>Action</td>
                    <td className="tl-val">{deriveAction(sadaAgent, sadaStep)}</td>
                  </tr>
                  <tr>
                    <td>Total Flips</td>
                    <td className="tl-val success">{sadaAgent.flips}</td>
                  </tr>
                  <tr>
                    <td>Completion</td>
                    <td className="tl-val">{sadaDone ? `✓ Step ${sadaAgent.completionStep}` : '…pending'}</td>
                  </tr>
                  {sadaFrame && agentIdx < sadaFrame.agentActions.length && (
                    <tr>
                      <td>Frame Tag</td>
                      <td className="tl-val">{sadaFrame.agentActions[agentIdx]}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <p className="tl-hint">
          🎯 Click any agent on the grid to inspect its historical state at each step
        </p>
      )}
    </div>
  );
});

export default TimelineDebugger;
