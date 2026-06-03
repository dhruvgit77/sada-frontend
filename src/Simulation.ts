export type Position = [number, number];

export interface AgentConfig {
  id: number;
  start: Position;
  goal: Position;
  K: number;
  beta: number;
  color: string;
}

export class PRNG {
  seed: number;
  constructor(seed: number) { this.seed = seed; }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export class Agent {
  id: number;
  pos: Position;
  start: Position;
  goal: Position;
  K: number;
  beta: number;
  use_sada: boolean;
  history: string[];
  path: Position[];
  flips: number;
  done: boolean;
  completionStep: number;
  color: string;

  constructor(config: AgentConfig, use_sada: boolean) {
    this.id = config.id;
    this.pos = [...config.start];
    this.start = [...config.start];
    this.goal = [...config.goal];
    this.K = config.K;
    this.beta = config.beta;
    this.use_sada = use_sada;
    this.history = [];
    this.path = [[...config.start]];
    this.flips = 0;
    this.done = false;
    this.completionStep = -1;
    this.color = config.color;
  }

  manhattan(p1: Position, p2: Position) {
    return Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]);
  }

  getActions(): { name: string; dx: number; dy: number }[] {
    return [
      { name: 'UP', dx: -1, dy: 0 },
      { name: 'DOWN', dx: 1, dy: 0 },
      { name: 'LEFT', dx: 0, dy: -1 },
      { name: 'RIGHT', dx: 0, dy: 1 },
      { name: 'WAIT', dx: 0, dy: 0 }
    ];
  }

  computeFlipCount(newAction: string) {
    if (this.history.length === 0) return 0;
    const tempHistory = [...this.history, newAction];
    let flips = 0;
    for (let i = 1; i < tempHistory.length; i++) {
      if (tempHistory[i] !== tempHistory[i - 1]) flips++;
    }
    return flips;
  }

  step(grid: number[][], otherAgents: Agent[], prng: PRNG, noiseScale = 1.0) {
    if (this.pos[0] === this.goal[0] && this.pos[1] === this.goal[1]) {
      if (!this.done) {
        this.done = true;
        this.completionStep = this.path.length - 1;
        if (this.history.length >= this.K) this.history.shift();
        this.history.push('WAIT');
      }
      this.path.push([...this.pos]);
      return;
    }

    const occupied = new Set(otherAgents.map(a => `${a.pos[0]},${a.pos[1]}`));
    let bestAction = 'WAIT';
    let bestCost = Infinity;
    let bestNextPos = this.pos;

    for (const action of this.getActions()) {
      const nextPos: Position = [this.pos[0] + action.dx, this.pos[1] + action.dy];

      if (
        nextPos[0] < 0 || nextPos[0] >= grid.length ||
        nextPos[1] < 0 || nextPos[1] >= grid[0].length ||
        grid[nextPos[0]][nextPos[1]] === 1
      ) {
        continue;
      }

      const distCost = this.manhattan(nextPos, this.goal);
      let colCost = 0;
      if (occupied.has(`${nextPos[0]},${nextPos[1]}`)) {
        colCost = 50;
      }

      // Deterministic noise ensuring Baseline/SADA see exact identical values
      const noise = prng.next() * 0.5 * noiseScale;
      const waitPenalty = action.name === 'WAIT' ? 2.0 : 0;
      
      let stabCost = 0;
      if (this.use_sada) {
        stabCost = this.beta * this.computeFlipCount(action.name);
      }

      const totalCost = distCost + colCost + stabCost + noise + waitPenalty;

      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestAction = action.name;
        bestNextPos = nextPos;
      }
    }

    if (this.history.length > 0 && bestAction !== this.history[this.history.length - 1]) {
      this.flips++;
    }

    if (this.history.length >= this.K) this.history.shift();
    this.history.push(bestAction);
    
    this.pos = bestNextPos;
    this.path.push([...this.pos]);
  }
}

export function simulate(grid: number[][], config: AgentConfig[], use_sada: boolean, maxSteps = 150, noiseScale = 1.0) {
  const agents = config.map(c => new Agent(c, use_sada));

  // Initialize PRNG with the exact same seed for every single run
  // This ensures Baseline and SADA models undergo the IDENTICAL stochastic evaluation
  const prng = new PRNG(1337);

  for (let step = 0; step < maxSteps; step++) {
    const indices = Array.from({ length: agents.length }, (_, i) => i);
    // Shuffle turns deterministically
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(prng.next() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    let allDone = true;
    for (const i of indices) {
      if (!agents[i].done) {
        allDone = false;
        agents[i].step(grid, agents.filter(a => a.id !== agents[i].id), prng, noiseScale);
      }
    }
    
    if (allDone) break;
  }
  
  const maxLen = Math.max(...agents.map(a => a.path.length));
  for (const agent of agents) {
    while (agent.path.length < maxLen) {
      agent.path.push([...agent.path[agent.path.length - 1]]);
    }
  }

  return agents;
}

export function evaluate(agents: Agent[]) {
  const totalFlips = agents.reduce((sum, a) => sum + a.flips, 0);
  const successRate = agents.filter(a => a.done).length / agents.length * 100;
  const avgPathLen = agents.reduce((sum, a) => sum + a.path.length, 0) / agents.length;
  
  return {
    totalFlips,
    successRate,
    avgPathLen
  };
}
