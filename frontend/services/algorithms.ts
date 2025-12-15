import { GraphData, AlgorithmParams, PathResult, AlgorithmType } from '../types';
import { calculatePathMetrics, calculateWeightedCost } from './graphGenerator';

// --- Shared Helpers ---

const MAX_STEPS = 500; // Loop prevention

// Random Walk to generate initial population
const randomWalk = (start: number, end: number, adj: Map<number, any[]>): number[] | null => {
    let current = start;
    const path = [current];
    const visited = new Set([current]);

    for (let i = 0; i < 100; i++) {
        if (current === end) return path;
        const neighbors = adj.get(current) || [];
        const validNeighbors = neighbors.filter(l => !visited.has(l.target));
        
        if (validNeighbors.length === 0) break; // Dead end

        // Simple heuristic: Prefer moving closer to target geometrically sometimes
        const chosen = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        current = chosen.target;
        path.push(current);
        visited.add(current);
    }
    return current === end ? path : null;
};

// Helper to mutate a path (find a neighbor solution)
const mutatePath = (originalPath: number[], end: number, adj: Map<number, any[]>): number[] => {
    if (originalPath.length <= 2) return originalPath;
    
    // Pick a random point to diverge
    const cutPoint = Math.floor(Math.random() * (originalPath.length - 2)) + 1;
    const prefix = originalPath.slice(0, cutPoint);
    const startNode = prefix[prefix.length - 1];
    
    // Try to find a new path from cutPoint to end
    const suffix = randomWalk(startNode, end, adj);
    
    if (suffix && suffix.length > 0) {
        // suffix[0] is startNode, so slice it off to avoid duplicate
        return [...prefix, ...suffix.slice(1)];
    }
    return originalPath;
};

// --- 1. Genetic Algorithm (GA) ---
// PDF Section 5.1: Chromosome = Path, Fitness = TotalCost
export const runGeneticAlgorithm = (
    graph: GraphData,
    start: number,
    end: number,
    weights: AlgorithmParams
): PathResult => {
    const startTime = performance.now();
    const POPULATION_SIZE = 50;
    const GENERATIONS = 50;
    const MUTATION_RATE = 0.2;

    // Initialize Population
    let population: number[][] = [];
    for(let i=0; i<POPULATION_SIZE * 2; i++) {
        const p = randomWalk(start, end, graph.adjacency);
        if(p) population.push(p);
    }
    if (population.length === 0) return { path: [], metrics: { totalDelay:0, totalReliability:0, resourceCost:0, weightedCost:0}, executionTime:0, algorithmName: AlgorithmType.GENETIC };

    // Evolution Loop
    for (let gen = 0; gen < GENERATIONS; gen++) {
        // Evaluate using PDF's TotalCost function
        const scoredParams = population.map(p => {
            const m = calculatePathMetrics(p, graph);
            const cost = calculateWeightedCost(m, weights);
            return { path: p, cost };
        });

        // Sort by lowest cost (Minimize TotalCost)
        scoredParams.sort((a, b) => a.cost - b.cost);

        // Selection (Keep top 50%)
        const survivors = scoredParams.slice(0, POPULATION_SIZE / 2).map(sp => sp.path);
        
        // Crossover & Mutation to refill
        const nextGen = [...survivors];
        while (nextGen.length < POPULATION_SIZE) {
            const parent = survivors[Math.floor(Math.random() * survivors.length)];
            if (Math.random() < MUTATION_RATE && parent.length > 3) {
                const cutPoint = Math.floor(Math.random() * (parent.length - 2)) + 1;
                const prefix = parent.slice(0, cutPoint);
                const newSuffix = randomWalk(prefix[prefix.length-1], end, graph.adjacency);
                if (newSuffix) {
                    nextGen.push([...prefix.slice(0, -1), ...newSuffix]);
                } else {
                    nextGen.push(parent); 
                }
            } else {
                nextGen.push(parent);
            }
        }
        population = nextGen;
    }

    const bestPath = population[0];
    const finalMetrics = calculatePathMetrics(bestPath, graph);
    const finalCost = calculateWeightedCost(finalMetrics, weights);

    return {
        path: bestPath,
        metrics: { ...finalMetrics, weightedCost: finalCost },
        executionTime: performance.now() - startTime,
        algorithmName: AlgorithmType.GENETIC
    };
};

// --- 2. Ant Colony Optimization (ACO) ---
// PDF Section 5.1: Ants deposit pheromone on low-cost paths
export const runACO = (
    graph: GraphData,
    start: number,
    end: number,
    weights: AlgorithmParams
): PathResult => {
    const startTime = performance.now();
    const NUM_ANTS = 20;
    const ITERATIONS = 20;
    const EVAPORATION = 0.1;
    const ALPHA = 1; 
    const BETA = 2; 

    const pheromones = new Map<string, number>();
    const getPheromone = (u: number, v: number) => pheromones.get(`${u}-${v}`) || 1.0;
    const setPheromone = (u: number, v: number, val: number) => pheromones.set(`${u}-${v}`, val);

    let bestGlobalPath: number[] = [];
    let bestGlobalCost = Infinity;

    for (let iter = 0; iter < ITERATIONS; iter++) {
        const antPaths: { path: number[], cost: number }[] = [];

        for (let ant = 0; ant < NUM_ANTS; ant++) {
            let current = start;
            const path = [current];
            const visited = new Set([current]);

            while (current !== end && path.length < MAX_STEPS) {
                const neighbors = graph.adjacency.get(current) || [];
                const valid = neighbors.filter(l => !visited.has(l.target));

                if (valid.length === 0) break;

                // Probabilistic selection
                const probs = valid.map(link => {
                    const tau = getPheromone(current, link.target);
                    // Heuristic = 1 / Local Cost
                    const localDelay = link.propagationDelay; 
                    const localRel = -Math.log(link.reliability);
                    const localRes = 1000/link.bandwidth;
                    const cost = weights.wDelay * localDelay + weights.wReliability * localRel + weights.wResource * localRes;
                    const eta = 1 / (cost + 0.1); 

                    return Math.pow(tau, ALPHA) * Math.pow(eta, BETA);
                });

                const sumProbs = probs.reduce((a, b) => a + b, 0);
                let r = Math.random() * sumProbs;
                let selectedIndex = 0;
                for(let i=0; i<probs.length; i++) {
                    r -= probs[i];
                    if (r <= 0) { selectedIndex = i; break; }
                }

                current = valid[selectedIndex].target;
                path.push(current);
                visited.add(current);
            }

            if (current === end) {
                const m = calculatePathMetrics(path, graph);
                const c = calculateWeightedCost(m, weights);
                antPaths.push({ path, cost: c });

                if (c < bestGlobalCost) {
                    bestGlobalCost = c;
                    bestGlobalPath = [...path];
                }
            }
        }

        // Pheromone Update
        pheromones.forEach((val, key) => pheromones.set(key, val * (1 - EVAPORATION)));
        antPaths.forEach(ap => {
            const deposit = 1 / ap.cost; 
            for (let i = 0; i < ap.path.length - 1; i++) {
                const u = ap.path[i];
                const v = ap.path[i+1];
                const old = getPheromone(u, v);
                setPheromone(u, v, old + deposit);
            }
        });
    }

    const finalMetrics = calculatePathMetrics(bestGlobalPath, graph);

    return {
        path: bestGlobalPath,
        metrics: { ...finalMetrics, weightedCost: bestGlobalCost },
        executionTime: performance.now() - startTime,
        algorithmName: AlgorithmType.ACO
    };
};

// --- 3. Q-Learning ---
// PDF Section 5.2: State=Node, Reward based on TotalCost
export const runQLearning = (
    graph: GraphData,
    start: number,
    end: number,
    weights: AlgorithmParams
): PathResult => {
    const startTime = performance.now();
    const EPISODES = 500; 
    const ALPHA = 0.1; 
    const GAMMA = 0.9; 
    const EPSILON = 0.1; 

    const QTable = new Map<number, Map<number, number>>();
    const getQ = (s: number, a: number) => QTable.get(s)?.get(a) || 0;
    const setQ = (s: number, a: number, val: number) => {
        if (!QTable.has(s)) QTable.set(s, new Map());
        QTable.get(s)!.set(a, val);
    };
    const getMaxQ = (s: number) => {
        if (!QTable.has(s)) return 0;
        return Math.max(...Array.from(QTable.get(s)!.values()));
    };

    for (let ep = 0; ep < EPISODES; ep++) {
        let current = start;
        let steps = 0;
        while (current !== end && steps < 100) {
            steps++;
            const neighbors = graph.adjacency.get(current) || [];
            if (neighbors.length === 0) break;

            let nextNode: number;
            if (Math.random() < EPSILON) {
                nextNode = neighbors[Math.floor(Math.random() * neighbors.length)].target;
            } else {
                let bestVal = -Infinity;
                let bestActions: number[] = [];
                neighbors.forEach(n => {
                    const val = getQ(current, n.target);
                    if (val > bestVal) { bestVal = val; bestActions = [n.target]; } 
                    else if (val === bestVal) bestActions.push(n.target);
                });
                nextNode = bestActions[Math.floor(Math.random() * bestActions.length)];
            }

            const link = neighbors.find(l => l.target === nextNode);
            if (!link) break;

            const localDelay = link.propagationDelay; 
            const localRel = -Math.log(link.reliability);
            const localRes = 1000/link.bandwidth;
            const stepCost = weights.wDelay * localDelay + weights.wReliability * localRel + weights.wResource * localRes;
            
            // Negative reward per step to minimize total cost
            let reward = -stepCost;
            if (nextNode === end) reward = 1000 / stepCost; // Bonus

            const currentQ = getQ(current, nextNode);
            const maxNextQ = nextNode === end ? 0 : getMaxQ(nextNode);
            const newQ = currentQ + ALPHA * (reward + GAMMA * maxNextQ - currentQ);
            setQ(current, nextNode, newQ);

            current = nextNode;
        }
    }

    const bestPath = [start];
    let curr = start;
    let loopGuard = 0;
    const visited = new Set([start]);
    while (curr !== end && loopGuard < 100) {
        loopGuard++;
        const neighbors = graph.adjacency.get(curr) || [];
        if (neighbors.length === 0) break;
        let bestNext = -1;
        let maxVal = -Infinity;
        neighbors.forEach(n => {
            if (!visited.has(n.target)) {
                const val = getQ(curr, n.target);
                if (val > maxVal) { maxVal = val; bestNext = n.target; }
            }
        });
        if (bestNext !== -1) {
            curr = bestNext;
            bestPath.push(curr);
            visited.add(curr);
        } else { break; }
    }

    const finalMetrics = calculatePathMetrics(bestPath, graph);
    const finalCost = calculateWeightedCost(finalMetrics, weights);
    return { path: bestPath, metrics: { ...finalMetrics, weightedCost: finalCost }, executionTime: performance.now() - startTime, algorithmName: AlgorithmType.Q_LEARNING };
};

// --- 4. Artificial Bee Colony (ABC) ---
// PDF Section 5.1: Mimics honey bees (Employed, Onlooker, Scout)
// Optimization Goal: Minimize "TotalCost" (Section 4)
export const runABC = (
    graph: GraphData,
    start: number,
    end: number,
    weights: AlgorithmParams
): PathResult => {
    const startTime = performance.now();
    
    // Parameters aligned with typical ABC implementation
    const COLONY_SIZE = 30; 
    const EMPLOYED_BEES = COLONY_SIZE / 2;
    const ONLOOKER_BEES = COLONY_SIZE / 2;
    const MAX_CYCLES = 30;
    const LIMIT = 5; // "Abandonment" limit for Scout Bees

    // Evaluate Cost (Minimization)
    const getCost = (p: number[]) => {
        const m = calculatePathMetrics(p, graph);
        return calculateWeightedCost(m, weights);
    };

    // Initialize Food Sources (Population)
    let foodSources: { path: number[], cost: number, trials: number }[] = [];
    
    for(let i=0; i<EMPLOYED_BEES; i++) {
        const p = randomWalk(start, end, graph.adjacency);
        if(p) {
            foodSources.push({ path: p, cost: getCost(p), trials: 0 });
        }
    }

    for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
        
        // 1. Employed Bees Phase (Search neighborhood/mutation)
        for (let i = 0; i < foodSources.length; i++) {
            const currentSource = foodSources[i];
            const newPath = mutatePath(currentSource.path, end, graph.adjacency);
            const newCost = getCost(newPath);

            // Greedy selection: if new path is better (lower cost), keep it
            if (newCost < currentSource.cost) {
                foodSources[i] = { path: newPath, cost: newCost, trials: 0 };
            } else {
                foodSources[i].trials += 1;
            }
        }

        // 2. Onlooker Bees Phase (Choose sources based on Fitness)
        if (foodSources.length > 0) {
            // Fitness = 1 / (1 + Cost) or similar inverse relationship
            const costs = foodSources.map(f => f.cost);
            const maxC = Math.max(...costs);
            // Higher prob for lower cost
            const fitnesses = foodSources.map(f => (maxC - f.cost) + 1); 
            const totalFitness = fitnesses.reduce((a,b) => a+b, 0);
            
            for (let k = 0; k < ONLOOKER_BEES; k++) {
                // Roulette Wheel
                let r = Math.random() * totalFitness;
                let selectedIndex = 0;
                for(let j=0; j<fitnesses.length; j++) {
                    r -= fitnesses[j];
                    if (r <= 0) { selectedIndex = j; break; }
                }

                const currentSource = foodSources[selectedIndex];
                const newPath = mutatePath(currentSource.path, end, graph.adjacency);
                const newCost = getCost(newPath);

                if (newCost < currentSource.cost) {
                    foodSources[selectedIndex] = { path: newPath, cost: newCost, trials: 0 };
                } else {
                    foodSources[selectedIndex].trials += 1;
                }
            }
        }

        // 3. Scout Bees Phase (Abandon stuck sources)
        for (let i = 0; i < foodSources.length; i++) {
            if (foodSources[i].trials > LIMIT) {
                const newPath = randomWalk(start, end, graph.adjacency);
                if (newPath) {
                    foodSources[i] = { path: newPath, cost: getCost(newPath), trials: 0 };
                } else {
                    foodSources[i].trials = 0;
                }
            }
        }
    }

    if (foodSources.length === 0) {
        return { path: [], metrics: { totalDelay:0, totalReliability:0, resourceCost:0, weightedCost:0}, executionTime:0, algorithmName: AlgorithmType.ABC };
    }

    // Return Best
    foodSources.sort((a, b) => a.cost - b.cost);
    const bestPath = foodSources[0].path;
    const finalMetrics = calculatePathMetrics(bestPath, graph);
    const finalCost = calculateWeightedCost(finalMetrics, weights);

    return {
        path: bestPath,
        metrics: { ...finalMetrics, weightedCost: finalCost },
        executionTime: performance.now() - startTime,
        algorithmName: AlgorithmType.ABC
    };
};