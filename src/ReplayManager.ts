import type { Position, Agent } from './Simulation';

export interface ReplayFrame {
  step: number;
  agentPositions: Position[];
  agentActions: string[];
  agentDone: boolean[];
  agentFlips: number[];
}

export interface ReplayData {
  version: number;
  isSada: boolean;
  beta: number;
  historyK: number;
  totalSteps: number;
  agentColors: string[];
  agentGoals: Position[];
  frames: ReplayFrame[];
}

function deriveAction(prev: Position, curr: Position): string {
  const dx = curr[0] - prev[0];
  const dy = curr[1] - prev[1];
  if (dx === -1) return 'UP';
  if (dx === 1) return 'DOWN';
  if (dy === -1) return 'LEFT';
  if (dy === 1) return 'RIGHT';
  return 'WAIT';
}

export function buildFrames(agents: Agent[]): ReplayFrame[] {
  if (!agents.length) return [];
  const maxLen = agents[0].path.length;
  const frames: ReplayFrame[] = [];
  for (let step = 0; step < maxLen; step++) {
    frames.push({
      step,
      agentPositions: agents.map(a => [...a.path[Math.min(step, a.path.length - 1)]] as Position),
      agentActions: agents.map(a => {
        if (step === 0) return 'START';
        const prev = a.path[Math.min(step - 1, a.path.length - 1)];
        const curr = a.path[Math.min(step, a.path.length - 1)];
        return deriveAction(prev, curr);
      }),
      agentDone: agents.map(a => a.done && (a.completionStep ?? -1) <= step),
      agentFlips: agents.map(a => a.flips),
    });
  }
  return frames;
}

export function packReplay(agents: Agent[], isSada: boolean, beta: number, historyK: number): ReplayData {
  return {
    version: 1,
    isSada,
    beta,
    historyK,
    totalSteps: agents[0]?.path.length ?? 0,
    agentColors: agents.map(a => a.color),
    agentGoals: agents.map(a => [...a.goal] as Position),
    frames: buildFrames(agents),
  };
}

export function saveReplayToJSON(data: ReplayData): void {
  const label = data.isSada ? 'sada' : 'baseline';
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sada_replay_${label}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function loadReplayFromFile(): Promise<ReplayData | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text) as ReplayData;
        if (data.version !== 1 || !data.frames?.length) { resolve(null); return; }
        resolve(data);
      } catch {
        resolve(null);
      }
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}
