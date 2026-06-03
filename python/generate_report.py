#!/usr/bin/env python3
"""
SADA Results Report Generator
Runs comprehensive benchmarks and generates results tables
"""

import numpy as np
import json
import time
from datetime import datetime
from collections import deque

class Agent:
    def __init__(self, id, start, goal, K=5, beta=2.0, use_sada=True):
        self.id = id
        self.pos = start
        self.start = start
        self.goal = goal
        self.K = K
        self.beta = beta
        self.use_sada = use_sada
        self.history = deque(maxlen=K)
        self.path = [start]
        self.flips = 0
        self.done = False

    def manhattan(self, p1, p2):
        return abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])

    def get_actions(self):
        return [
            ('UP', (-1, 0)),
            ('DOWN', (1, 0)),
            ('LEFT', (0, -1)),
            ('RIGHT', (0, 1)),
            ('WAIT', (0, 0))
        ]

    def compute_flip_count(self, new_action):
        if not self.history:
            return 0
        temp_history = list(self.history) + [new_action]
        flips = 0
        for i in range(1, len(temp_history)):
            if temp_history[i] != temp_history[i-1]:
                flips += 1
        return flips

    def step(self, grid, other_agents, noise_val=0):
        if self.pos == self.goal:
            if not self.done:
                self.done = True
                self.history.append('WAIT')
            self.path.append(self.pos)
            return

        actions = self.get_actions()
        best_action = None
        best_cost = float('inf')
        best_next_pos = self.pos

        occupied = {a.pos for a in other_agents if a.id != self.id}

        for action_name, (dx, dy) in actions:
            next_pos = (self.pos[0] + dx, self.pos[1] + dy)

            if (next_pos[0] < 0 or next_pos[0] >= grid.shape[0] or
                next_pos[1] < 0 or next_pos[1] >= grid.shape[1] or
                grid[next_pos] == 1):
                continue

            dist_cost = self.manhattan(next_pos, self.goal)
            col_cost = 50 if next_pos in occupied else 0
            wait_penalty = 2.0 if action_name == 'WAIT' else 0
            
            stab_cost = 0
            if self.use_sada:
                stab_cost = self.beta * self.compute_flip_count(action_name)

            total_cost = dist_cost + col_cost + stab_cost + noise_val + wait_penalty

            if total_cost < best_cost:
                best_cost = total_cost
                best_action = action_name
                best_next_pos = next_pos

        if best_action is None:
            best_action = 'WAIT'

        if len(self.history) > 0 and best_action != self.history[-1]:
            self.flips += 1

        self.history.append(best_action)
        self.pos = best_next_pos
        self.path.append(self.pos)


def run_simulation(grid, agents_config, use_sada, max_steps=150):
    """Run a single simulation"""
    agents = []
    for conf in agents_config:
        agents.append(Agent(
            conf['id'], conf['start'], conf['goal'],
            K=conf.get('K', 5), 
            beta=conf.get('beta', 8.0),
            use_sada=use_sada
        ))
    
    for step in range(max_steps):
        # Deterministic shuffle
        np.random.seed(1337 + step)
        indices = np.random.permutation(len(agents))
        
        all_done = True
        for i in indices:
            agent = agents[i]
            if not agent.done:
                all_done = False
                noise = np.random.uniform(0, 0.5)
                agent.step(grid, agents, noise)
        
        if all_done:
            break
            
    # Pad paths
    max_len = max(len(a.path) for a in agents)
    for a in agents:
        while len(a.path) < max_len:
            a.path.append(a.path[-1])
            
    return agents


def evaluate(agents):
    """Compute metrics"""
    total_flips = sum(a.flips for a in agents)
    success_rate = sum(1 for a in agents if a.done) / len(agents) * 100
    avg_path_len = np.mean([len(a.path) for a in agents])
    
    smoothness_vals = []
    for a in agents:
        if len(a.path) < 2:
            smoothness_vals.append(100.0)
        else:
            non_flips = max(0, len(a.path) - 1 - a.flips)
            smoothness_vals.append((non_flips / (len(a.path) - 1)) * 100)
    
    smoothness = np.mean(smoothness_vals)
    
    return {
        'flips': total_flips,
        'success': success_rate,
        'path_len': avg_path_len,
        'smoothness': smoothness
    }


def generate_random_grid(size=20, density=0.12):
    """Generate random grid with obstacles"""
    grid = np.random.random((size, size)) < density
    return grid.astype(int)


def generate_random_agents(grid, count, K, beta):
    """Generate random agents with valid start/goal positions"""
    size = grid.shape[0]
    occupied = set()
    agents = []
    
    for i in range(count):
        # Find valid start
        while True:
            start = (np.random.randint(0, size), np.random.randint(0, size))
            if grid[start] == 0 and start not in occupied:
                occupied.add(start)
                break
        
        # Find valid goal
        while True:
            goal = (np.random.randint(0, size), np.random.randint(0, size))
            if grid[goal] == 0 and goal not in occupied:
                occupied.add(goal)
                break
        
        agents.append({
            'id': i + 1,
            'start': start,
            'goal': goal,
            'K': K,
            'beta': beta
        })
    
    return agents


def test_scalability():
    """Test scalability across agent counts"""
    print("\n" + "="*70)
    print("SCALABILITY TEST: Varying Agent Counts")
    print("="*70)
    
    agent_counts = [5, 10, 20, 30]
    trials_per_count = 5
    results = []
    
    for count in agent_counts:
        print(f"\nTesting with {count} agents ({trials_per_count} trials)...")
        
        baseline_metrics = {'flips': [], 'success': [], 'path_len': []}
        sada_metrics = {'flips': [], 'success': [], 'path_len': []}
        
        for trial in range(trials_per_count):
            # Generate random environment
            grid = generate_random_grid()
            agents = generate_random_agents(grid, count, K=5, beta=8.0)
            
            # Run baseline
            base_agents = run_simulation(grid, agents, use_sada=False, max_steps=200)
            base_eval = evaluate(base_agents)
            baseline_metrics['flips'].append(base_eval['flips'])
            baseline_metrics['success'].append(base_eval['success'])
            baseline_metrics['path_len'].append(base_eval['path_len'])
            
            # Run SADA
            sada_agents = run_simulation(grid, agents, use_sada=True, max_steps=200)
            sada_eval = evaluate(sada_agents)
            sada_metrics['flips'].append(sada_eval['flips'])
            sada_metrics['success'].append(sada_eval['success'])
            sada_metrics['path_len'].append(sada_eval['path_len'])
        
        # Average metrics
        avg_base_flips = np.mean(baseline_metrics['flips'])
        avg_sada_flips = np.mean(sada_metrics['flips'])
        flip_reduction = (avg_base_flips - avg_sada_flips) / avg_base_flips * 100 if avg_base_flips > 0 else 0
        
        avg_base_success = np.mean(baseline_metrics['success'])
        avg_sada_success = np.mean(sada_metrics['success'])
        
        avg_base_path = np.mean(baseline_metrics['path_len'])
        avg_sada_path = np.mean(sada_metrics['path_len'])
        path_overhead = (avg_sada_path - avg_base_path) / avg_base_path * 100 if avg_base_path > 0 else 0
        
        results.append({
            'agents': count,
            'base_flips': avg_base_flips,
            'sada_flips': avg_sada_flips,
            'flip_reduction': flip_reduction,
            'base_success': avg_base_success,
            'sada_success': avg_sada_success,
            'base_path': avg_base_path,
            'sada_path': avg_sada_path,
            'path_overhead': path_overhead
        })
        
        print(f"  Baseline Flips: {avg_base_flips:.1f} | SADA Flips: {avg_sada_flips:.1f} ({flip_reduction:.1f}% ↓)")
        print(f"  Success Rate: {avg_base_success:.1f}% → {avg_sada_success:.1f}%")
        print(f"  Path Length: {avg_base_path:.1f} → {avg_sada_path:.1f} ({path_overhead:+.1f}%)")
    
    return results


def test_sensitivity():
    """Test sensitivity to β parameter"""
    print("\n" + "="*70)
    print("PARAMETER SENSITIVITY TEST: β Variation (K=5, 6 agents)")
    print("="*70)
    
    betas = [2, 4, 6, 8, 10, 12]
    trials_per_beta = 3
    results = []
    
    for beta in betas:
        print(f"\nTesting β={beta} ({trials_per_beta} trials)...")
        
        metrics = {'flips': [], 'success': [], 'path_len': [], 'smoothness': []}
        
        for trial in range(trials_per_beta):
            grid = generate_random_grid()
            agents = generate_random_agents(grid, 6, K=5, beta=beta)
            
            sada_agents = run_simulation(grid, agents, use_sada=True, max_steps=150)
            eval_result = evaluate(sada_agents)
            
            metrics['flips'].append(eval_result['flips'])
            metrics['success'].append(eval_result['success'])
            metrics['path_len'].append(eval_result['path_len'])
            metrics['smoothness'].append(eval_result['smoothness'])
        
        avg_result = {
            'beta': beta,
            'flips': np.mean(metrics['flips']),
            'success': np.mean(metrics['success']),
            'path_len': np.mean(metrics['path_len']),
            'smoothness': np.mean(metrics['smoothness'])
        }
        
        results.append(avg_result)
        
        print(f"  Flips: {avg_result['flips']:.1f} | Success: {avg_result['success']:.1f}% | Smoothness: {avg_result['smoothness']:.1f}%")
    
    return results


def print_tables(scale_results, sensitivity_results):
    """Print formatted result tables"""
    
    print("\n" + "="*100)
    print("SCALABILITY RESULTS TABLE")
    print("="*100)
    print(f"{'Agents':<8} {'Base Flips':<12} {'SADA Flips':<12} {'Flip ↓':<10} {'Base Succ%':<12} {'SADA Succ%':<12} {'Path Δ':<10}")
    print("-"*100)
    
    for r in scale_results:
        print(f"{r['agents']:<8.0f} {r['base_flips']:<12.1f} {r['sada_flips']:<12.1f} {r['flip_reduction']:<10.1f}% {r['base_success']:<12.1f} {r['sada_success']:<12.1f} {r['path_overhead']:+<10.1f}%")
    
    print("\n" + "="*100)
    print("PARAMETER SENSITIVITY TABLE (K=5)")
    print("="*100)
    print(f"{'β':<6} {'Total Flips':<14} {'Success %':<12} {'Avg Path':<12} {'Smoothness %':<14}")
    print("-"*100)
    
    for r in sensitivity_results:
        print(f"{r['beta']:<6.0f} {r['flips']:<14.1f} {r['success']:<12.1f} {r['path_len']:<12.1f} {r['smoothness']:<14.1f}")


def main():
    print("\n" + "="*70)
    print("SADA RESULTS REPORT GENERATOR")
    print("="*70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Run tests
    scale_results = test_scalability()
    sensitivity_results = test_sensitivity()
    
    # Print tables
    print_tables(scale_results, sensitivity_results)
    
    # Save to JSON
    report = {
        'timestamp': datetime.now().isoformat(),
        'scalability': scale_results,
        'sensitivity': sensitivity_results,
        'summary': {
            'mean_flip_reduction': f"{np.mean([r['flip_reduction'] for r in scale_results]):.1f}%",
            'mean_path_overhead': f"{np.mean([r['path_overhead'] for r in scale_results]):.1f}%",
            'success_maintained': '✓' if all(r['sada_success'] >= 85 for r in scale_results) else '✗'
        }
    }
    
    with open('sada_results.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n✅ Results saved to sada_results.json")
    print("\nSummary:")
    print(f"  Mean Flip Reduction: {report['summary']['mean_flip_reduction']}")
    print(f"  Mean Path Overhead: {report['summary']['mean_path_overhead']}")
    print(f"  Success Rate: {report['summary']['success_maintained']}")


if __name__ == '__main__':
    main()
