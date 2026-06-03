import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.colors import ListedColormap
from collections import deque
import copy
import os

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
        # returns list of (action_name, (dx, dy))
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

    def step(self, grid, other_agents):
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

        # Dynamic obstacles: current positions of other agents
        occupied = {a.pos for a in other_agents if a.id != self.id}

        for action_name, (dx, dy) in actions:
            next_pos = (self.pos[0] + dx, self.pos[1] + dy)

            # Check bounds and static obstacles
            if (next_pos[0] < 0 or next_pos[0] >= grid.shape[0] or
                next_pos[1] < 0 or next_pos[1] >= grid.shape[1] or
                grid[next_pos] == 1):
                continue

            # Distance cost to goal
            dist_cost = self.manhattan(next_pos, self.goal)
            
            # Collision penalty
            col_cost = 0
            if next_pos in occupied:
                col_cost = 50  # High penalty to avoid collision

            # To induce jitter in baseline, add random noise when costs are similar
            noise = np.random.uniform(0, 0.5)
            
            # Penalize waiting if not at goal to encourage moving around obstacles
            wait_penalty = 0
            if action_name == 'WAIT':
                wait_penalty = 2.0
            
            # Stability cost
            stab_cost = 0
            if self.use_sada:
                stab_cost = self.beta * self.compute_flip_count(action_name)

            total_cost = dist_cost + col_cost + stab_cost + noise + wait_penalty

            if total_cost < best_cost:
                best_cost = total_cost
                best_action = action_name
                best_next_pos = next_pos

        if best_action is None:
            best_action = 'WAIT'
            best_next_pos = self.pos

        if len(self.history) > 0 and best_action != self.history[-1]:
            self.flips += 1

        self.history.append(best_action)
        self.pos = best_next_pos
        self.path.append(self.pos)

def run_simulation(grid, agents_config, use_sada, max_steps=100):
    agents = []
    for conf in agents_config:
        agents.append(Agent(conf['id'], conf['start'], conf['goal'], 
                            K=conf.get('K', 5), beta=conf.get('beta', 3.0), use_sada=use_sada))
    
    for step in range(max_steps):
        # Process agents sequentially to avoid real collisions
        np.random.seed(42 + step) # reproducibility
        indices = np.random.permutation(len(agents))
        
        all_done = True
        for i in indices:
            agent = agents[i]
            if not agent.done:
                all_done = False
                agent.step(grid, agents)
        
        # If all done, pad the paths so they have same length
        if all_done:
            break
            
    # Pad paths so all agents have same path length
    max_len = max(len(a.path) for a in agents)
    for a in agents:
        while len(a.path) < max_len:
            a.path.append(a.path[-1])
            
    return agents

def evaluate(agents):
    total_flips = sum(a.flips for a in agents)
    success_rate = sum(1 for a in agents if a.done) / len(agents) * 100
    avg_path_len = np.mean([len(a.path) for a in agents])
    return {
        'flips': total_flips,
        'success': success_rate,
        'path_len': avg_path_len
    }

def create_animation(grid, base_agents, sada_agents, filename="sada_comparison.gif"):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))
    
    cmap = ListedColormap(['white', 'black'])
    
    ax1.imshow(grid, cmap=cmap)
    ax1.set_title('Baseline (Standard Cost)')
    ax1.set_xticks([])
    ax1.set_yticks([])
    
    ax2.imshow(grid, cmap=cmap)
    ax2.set_title('SADA (Stability-Aware)')
    ax2.set_xticks([])
    ax2.set_yticks([])
    
    # Colors for agents
    colors = ['red', 'blue', 'green', 'orange', 'purple', 'cyan']
    
    # Plot goals
    for i, a in enumerate(base_agents):
        ax1.plot(a.goal[1], a.goal[0], marker='X', color=colors[i%len(colors)], markersize=10)
        ax2.plot(a.goal[1], a.goal[0], marker='X', color=colors[i%len(colors)], markersize=10)

    # Agent dots
    base_dots = [ax1.plot([], [], marker='o', color=colors[i%len(colors)], markersize=8)[0] for i in range(len(base_agents))]
    sada_dots = [ax2.plot([], [], marker='o', color=colors[i%len(colors)], markersize=8)[0] for i in range(len(sada_agents))]
    
    # Agent paths
    base_lines = [ax1.plot([], [], color=colors[i%len(colors)], alpha=0.5)[0] for i in range(len(base_agents))]
    sada_lines = [ax2.plot([], [], color=colors[i%len(colors)], alpha=0.5)[0] for i in range(len(sada_agents))]

    max_steps = max(len(base_agents[0].path), len(sada_agents[0].path))

    def init():
        for dot, line in zip(base_dots, base_lines):
            dot.set_data([], [])
            line.set_data([], [])
        for dot, line in zip(sada_dots, sada_lines):
            dot.set_data([], [])
            line.set_data([], [])
        return base_dots + base_lines + sada_dots + sada_lines

    def animate(i):
        # Baseline
        base_step = min(i, len(base_agents[0].path)-1)
        for j, agent in enumerate(base_agents):
            pos = agent.path[base_step]
            base_dots[j].set_data([pos[1]], [pos[0]])
            
            path_so_far = agent.path[:base_step+1]
            y_vals, x_vals = zip(*path_so_far)
            base_lines[j].set_data(x_vals, y_vals)
            
        # SADA
        sada_step = min(i, len(sada_agents[0].path)-1)
        for j, agent in enumerate(sada_agents):
            pos = agent.path[sada_step]
            sada_dots[j].set_data([pos[1]], [pos[0]])
            
            path_so_far = agent.path[:sada_step+1]
            y_vals, x_vals = zip(*path_so_far)
            sada_lines[j].set_data(x_vals, y_vals)
            
        return base_dots + base_lines + sada_dots + sada_lines

    ani = animation.FuncAnimation(fig, animate, init_func=init, frames=max_steps+10, interval=200, blit=True)
    ani.save(filename, writer='pillow')
    plt.close()

if __name__ == "__main__":
    # Setup Grid
    grid_size = 20
    grid = np.zeros((grid_size, grid_size))
    
    # Create an open central area with scattered obstacles
    grid[6:8, 6:8] = 1
    grid[12:14, 12:14] = 1
    grid[6:8, 12:14] = 1
    grid[12:14, 6:8] = 1

    # Agent configurations (more agents, larger K and beta)
    agents_config = [
        {'id': 1, 'start': (2, 10), 'goal': (18, 10), 'K': 7, 'beta': 20.0},
        {'id': 2, 'start': (18, 10), 'goal': (2, 10), 'K': 7, 'beta': 20.0},
        {'id': 3, 'start': (10, 2), 'goal': (10, 18), 'K': 7, 'beta': 20.0},
        {'id': 4, 'start': (10, 18), 'goal': (10, 2), 'K': 7, 'beta': 20.0},
        {'id': 5, 'start': (2, 2), 'goal': (18, 18), 'K': 7, 'beta': 20.0},
    ]

    print("Running Baseline Simulation...")
    baseline_agents = run_simulation(grid, agents_config, use_sada=False, max_steps=150)
    
    print("Running SADA Simulation...")
    sada_agents = run_simulation(grid, agents_config, use_sada=True, max_steps=150)

    base_stats = evaluate(baseline_agents)
    sada_stats = evaluate(sada_agents)
    
    print("\n================ Evaluation Metrics ================")
    print("Baseline Statistics:")
    print(f"Total Flips (Jitter): {base_stats['flips']}")
    print(f"Success Rate: {base_stats['success']}%")
    print(f"Average Path Length: {base_stats['path_len']:.2f}")

    print("\nSADA Statistics:")
    print(f"Total Flips (Jitter): {sada_stats['flips']}")
    print(f"Success Rate: {sada_stats['success']}%")
    print(f"Average Path Length: {sada_stats['path_len']:.2f}")
    
    print("\nGenerating Side-by-Side Animation...")
    create_animation(grid, baseline_agents, sada_agents, "sada_comparison.gif")
    print("Animation saved to 'sada_comparison.gif'")
