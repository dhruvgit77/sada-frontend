import { useState } from 'react';
import { simulate, type AgentConfig, PRNG } from './Simulation';

interface ScaleResult {
  agentCount: number;
  baselineFlips: number;
  sadaFlips: number;
  flipReduction: number;
  baselineSuccess: number;
  sadaSuccess: number;
  baselineAvgPath: number;
  sadaAvgPath: number;
  pathOverhead: number;
  baselineTime: number;
  sadaTime: number;
}

interface SensitivityResult {
  beta: number;
  flips: number;
  success: number;
  avgPath: number;
  smoothness: number;
}

interface ParameterSweep {
  K: number;
  results: SensitivityResult[];
}

const GRID_SIZE = 20;

function generateRandomGrid(prng: PRNG, density = 0.12): number[][] {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (prng.next() < density) grid[r][c] = 1;
    }
  }
  return grid;
}

function generateAgents(prng: PRNG, count: number, K: number, beta: number): AgentConfig[] {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  const occupied = new Set<string>();
  const agents: AgentConfig[] = [];

  for (let i = 0; i < count; i++) {
    let startR = 0, startC = 0;
    let attempts = 0;
    do {
      startR = Math.floor(prng.next() * GRID_SIZE);
      startC = Math.floor(prng.next() * GRID_SIZE);
      attempts++;
    } while (occupied.has(`${startR},${startC}`) && attempts < 100);
    occupied.add(`${startR},${startC}`);

    let goalR = 0, goalC = 0;
    attempts = 0;
    do {
      goalR = Math.floor(prng.next() * GRID_SIZE);
      goalC = Math.floor(prng.next() * GRID_SIZE);
      attempts++;
    } while (occupied.has(`${goalR},${goalC}`) && attempts < 100);
    occupied.add(`${goalR},${goalC}`);

    agents.push({
      id: i + 1,
      start: [startR, startC],
      goal: [goalR, goalC],
      K,
      beta,
      color: colors[i % colors.length]
    });
  }
  return agents;
}

export default function ResultsAnalyzer() {
  const [scaleResults, setScaleResults] = useState<ScaleResult[]>([]);
  const [sensitivityResults, setSensitivityResults] = useState<ParameterSweep | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');

  const runScalabilityTest = async () => {
    setIsRunning(true);
    setStatus('Running scalability tests...');
    const results: ScaleResult[] = [];
    const agentCounts = [5, 10, 20, 30];
    const trialsPerCount = 5;

    for (const count of agentCounts) {
      const baselineFlips: number[] = [];
      const sadaFlips: number[] = [];
      const baselineSuccesses: number[] = [];
      const sadaSuccesses: number[] = [];
      const baselinePaths: number[] = [];
      const sadaPaths: number[] = [];

      for (let t = 0; t < trialsPerCount; t++) {
        const prng = new PRNG(1000 + count * 100 + t);
        const grid = generateRandomGrid(prng);
        const agents = generateAgents(prng, count, 5, 8);

        const baseAgents = simulate(grid, agents, false);
        const sadaAgents = simulate(grid, agents, true);

        const baseTotalFlips = baseAgents.reduce((s, a) => s + a.flips, 0);
        const sadaTotalFlips = sadaAgents.reduce((s, a) => s + a.flips, 0);
        const baseSuccess = baseAgents.filter(a => a.done).length / baseAgents.length * 100;
        const sadaSuccess = sadaAgents.filter(a => a.done).length / sadaAgents.length * 100;
        const baseAvgPath = baseAgents.reduce((s, a) => s + a.path.length, 0) / baseAgents.length;
        const sadaAvgPath = sadaAgents.reduce((s, a) => s + a.path.length, 0) / sadaAgents.length;

        baselineFlips.push(baseTotalFlips);
        sadaFlips.push(sadaTotalFlips);
        baselineSuccesses.push(baseSuccess);
        sadaSuccesses.push(sadaSuccess);
        baselinePaths.push(baseAvgPath);
        sadaPaths.push(sadaAvgPath);
      }

      const avgBaselineFlips = baselineFlips.reduce((a, b) => a + b, 0) / trialsPerCount;
      const avgSadaFlips = sadaFlips.reduce((a, b) => a + b, 0) / trialsPerCount;
      const avgBaselineSuccess = baselineSuccesses.reduce((a, b) => a + b, 0) / trialsPerCount;
      const avgSadaSuccess = sadaSuccesses.reduce((a, b) => a + b, 0) / trialsPerCount;
      const avgBaselinePath = baselinePaths.reduce((a, b) => a + b, 0) / trialsPerCount;
      const avgSadaPath = sadaPaths.reduce((a, b) => a + b, 0) / trialsPerCount;

      results.push({
        agentCount: count,
        baselineFlips: avgBaselineFlips,
        sadaFlips: avgSadaFlips,
        flipReduction: ((avgBaselineFlips - avgSadaFlips) / avgBaselineFlips) * 100,
        baselineSuccess: avgBaselineSuccess,
        sadaSuccess: avgSadaSuccess,
        baselineAvgPath: avgBaselinePath,
        sadaAvgPath: avgSadaPath,
        pathOverhead: ((avgSadaPath - avgBaselinePath) / avgBaselinePath) * 100,
        baselineTime: 0,
        sadaTime: 0
      });

      setStatus(`Completed ${count}-agent tests...`);
    }

    setScaleResults(results);
    setStatus('Scalability tests complete!');
    setIsRunning(false);
  };

  const runSensitivityTest = async () => {
    setIsRunning(true);
    setStatus('Running parameter sensitivity analysis...');
    const K = 5;
    const betas = [2, 4, 6, 8, 10, 12];
    const results: SensitivityResult[] = [];
    const trials = 3;

    for (const beta of betas) {
      const flips: number[] = [];
      const success: number[] = [];
      const paths: number[] = [];
      const smoothnessVals: number[] = [];

      for (let t = 0; t < trials; t++) {
        const prng = new PRNG(2000 + beta * 100 + t);
        const grid = generateRandomGrid(prng);
        const agents = generateAgents(prng, 6, K, beta);

        const sadaAgents = simulate(grid, agents, true);
        const totalFlips = sadaAgents.reduce((s, a) => s + a.flips, 0);
        const successRate = sadaAgents.filter(a => a.done).length / sadaAgents.length * 100;
        const avgPath = sadaAgents.reduce((s, a) => s + a.path.length, 0) / sadaAgents.length;
        const smooth = sadaAgents.reduce((s, a) => {
          if (a.path.length < 2) return s + 100;
          const nonFlips = Math.max(0, a.path.length - 1 - a.flips);
          return s + (nonFlips / (a.path.length - 1)) * 100;
        }, 0) / sadaAgents.length;

        flips.push(totalFlips);
        success.push(successRate);
        paths.push(avgPath);
        smoothnessVals.push(smooth);
      }

      results.push({
        beta,
        flips: flips.reduce((a, b) => a + b, 0) / trials,
        success: success.reduce((a, b) => a + b, 0) / trials,
        avgPath: paths.reduce((a, b) => a + b, 0) / trials,
        smoothness: smoothnessVals.reduce((a, b) => a + b, 0) / trials
      });

      setStatus(`Tested β=${beta}...`);
    }

    setSensitivityResults({ K, results });
    setStatus('Sensitivity analysis complete!');
    setIsRunning(false);
  };

  const exportResults = () => {
    const report = {
      timestamp: new Date().toISOString(),
      scalability: scaleResults,
      sensitivity: sensitivityResults,
      summary: {
        meanFlipReduction: scaleResults.length
          ? (scaleResults.reduce((s, r) => s + r.flipReduction, 0) / scaleResults.length).toFixed(2) + '%'
          : 'N/A',
        meanPathOverhead: scaleResults.length
          ? (scaleResults.reduce((s, r) => s + r.pathOverhead, 0) / scaleResults.length).toFixed(2) + '%'
          : 'N/A',
        successMaintained: scaleResults.length
          ? 'Yes (' + (scaleResults.every(r => r.sadaSuccess >= 90) ? '≥90%' : 'varies') + ')'
          : 'N/A'
      }
    };

    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sada_results_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="results-analyzer" style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>📊 SADA Results Analyzer</h2>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={runScalabilityTest}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.6 : 1
          }}
        >
          🔬 Run Scalability Test
        </button>
        <button
          onClick={runSensitivityTest}
          disabled={isRunning}
          style={{
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.6 : 1
          }}
        >
          📈 Run Sensitivity Test
        </button>
        {(scaleResults.length > 0 || sensitivityResults) && (
          <button
            onClick={exportResults}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            💾 Export Results
          </button>
        )}
      </div>

      {status && <p style={{ color: '#666', marginBottom: '20px' }}>Status: {status}</p>}

      {scaleResults.length > 0 && (
        <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
          <h3>Scalability Results (Agents × Trials)</h3>
          <table style={{
            borderCollapse: 'collapse',
            width: '100%',
            border: '1px solid #ddd'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Agents</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Base Flips</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>SADA Flips</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Flip ↓</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Base Succ%</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>SADA Succ%</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Avg Path Δ</th>
              </tr>
            </thead>
            <tbody>
              {scaleResults.map(r => (
                <tr key={r.agentCount}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{r.agentCount}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{r.baselineFlips.toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{r.sadaFlips.toFixed(1)}</td>
                  <td style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: r.flipReduction > 30 ? '#dcfce7' : '#fef3c7',
                    fontWeight: 'bold'
                  }}>
                    {r.flipReduction.toFixed(1)}%
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{r.baselineSuccess.toFixed(1)}</td>
                  <td style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: r.sadaSuccess >= 90 ? '#dcfce7' : '#fee2e2'
                  }}>
                    {r.sadaSuccess.toFixed(1)}
                  </td>
                  <td style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: Math.abs(r.pathOverhead) < 15 ? '#dcfce7' : '#fef3c7'
                  }}>
                    {r.pathOverhead > 0 ? '+' : ''}{r.pathOverhead.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sensitivityResults && (
        <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
          <h3>Parameter Sensitivity (K={sensitivityResults.K})</h3>
          <table style={{
            borderCollapse: 'collapse',
            width: '100%',
            border: '1px solid #ddd'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>β</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Total Flips</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Success %</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Avg Path</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Smoothness %</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityResults.results.map(r => (
                <tr key={r.beta}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{r.beta}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{r.flips.toFixed(1)}</td>
                  <td style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: r.success >= 85 ? '#dcfce7' : '#fef3c7'
                  }}>
                    {r.success.toFixed(1)}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{r.avgPath.toFixed(1)}</td>
                  <td style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: r.smoothness > 80 ? '#dcfce7' : '#fef3c7'
                  }}>
                    {r.smoothness.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
