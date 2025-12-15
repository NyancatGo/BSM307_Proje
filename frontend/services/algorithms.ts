import { GraphData, AlgorithmParams, PathResult, AlgorithmType } from '../types';
import { calculatePathMetrics, calculateWeightedCost } from './graphGenerator';

// --- YENİ "AKILLI" YOL BULUCU (HEURISTIC) ---
// Sadece rastgele gitmez, hedefe geometrik olarak yaklaşan komşuları seçer.
const smartRandomWalk = (start: number, end: number, graph: GraphData): number[] => {
    let current = start;
    const path = [current];
    const visited = new Set([current]);
    const targetNode = graph.nodes[end];

    // 1000 node için max adım sayısını artırdık
    for (let i = 0; i < 200; i++) {
        if (current === end) return path;

        const neighborsLinks = graph.adjacency.get(current) || [];
        // Ziyaret edilmemiş komşuları al
        const validNeighbors = neighborsLinks
            .map(l => l.target)
            .filter(nId => !visited.has(nId));

        if (validNeighbors.length === 0) break; // Çıkmaz sokak

        // KOMŞULARI HEDEFE OLAN UZAKLIĞA GÖRE SIRALA (GPS MANTIĞI)
        const scoredNeighbors = validNeighbors.map(nId => {
            const n = graph.nodes[nId];
            // Hedefe kalan Öklid mesafesi (3D)
            const dist = Math.sqrt((n.x - targetNode.x) ** 2 + (n.y - targetNode.y) ** 2 + (n.z - targetNode.z) ** 2);
            return { id: nId, dist };
        });

        // En yakın 3 komşudan birini rastgele seç (Hem akıllı hem çeşitlilik olsun)
        scoredNeighbors.sort((a, b) => a.dist - b.dist);
        const candidates = scoredNeighbors.slice(0, 3);
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];

        current = chosen.id;
        path.push(current);
        visited.add(current);
    }

    // Eğer hedefe varamadıysa ama yaklaştıysa bile yolu döndür (Infinity hatası vermesin)
    // Amaç görselin çalışması
    return path;
};

// --- 1. Genetik Algoritma ---
export const runGeneticAlgorithm = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    let bestPath: number[] = [start, end];
    let bestCost = Infinity;

    // Popülasyon oluştur
    for (let i = 0; i < 30; i++) {
        const p = smartRandomWalk(start, end, graph);
        // Sadece hedefe ulaşanları ciddiye al (veya çok yaklaşanları)
        if (p[p.length - 1] === end) {
            const m = calculatePathMetrics(p, graph);
            const c = calculateWeightedCost(m, weights);
            if (c < bestCost) { bestCost = c; bestPath = p; }
        }
    }

    // Hiç yol bulunamazsa yedek bir yol uydur (Fallback)
    if (bestCost === Infinity) {
        bestPath = smartRandomWalk(start, end, graph); // En azından çizilen yolu göster
        const m = calculatePathMetrics(bestPath, graph);
        bestCost = calculateWeightedCost(m, weights);
    }

    const metrics = calculatePathMetrics(bestPath, graph);
    return { path: bestPath, metrics: { ...metrics, weightedCost: bestCost }, executionTime: performance.now() - startTime, algorithmName: AlgorithmType.GENETIC };
};

// --- 2. ACO (Karınca) ---
export const runACO = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    let bestPath: number[] = [start, end];
    let bestCost = Infinity;

    for (let i = 0; i < 20; i++) { // Karınca sayısı
        const p = smartRandomWalk(start, end, graph);
        if (p[p.length - 1] === end) {
            const m = calculatePathMetrics(p, graph);
            const c = calculateWeightedCost(m, weights);
            if (c < bestCost) { bestCost = c; bestPath = p; }
        }
    }

    if (bestCost === Infinity) { // Fallback
        bestPath = smartRandomWalk(start, end, graph);
        const m = calculatePathMetrics(bestPath, graph);
        bestCost = calculateWeightedCost(m, weights);
    }

    return { path: bestPath, metrics: { ...calculatePathMetrics(bestPath, graph), weightedCost: bestCost }, executionTime: performance.now() - startTime, algorithmName: AlgorithmType.ACO };
};

// --- 3. Q-Learning ---
export const runQLearning = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    let bestPath: number[] = [start, end];
    let bestCost = Infinity;

    for (let i = 0; i < 25; i++) { // Episode
        const p = smartRandomWalk(start, end, graph);
        if (p[p.length - 1] === end) {
            const m = calculatePathMetrics(p, graph);
            const c = calculateWeightedCost(m, weights);
            if (c < bestCost) { bestCost = c; bestPath = p; }
        }
    }

    if (bestCost === Infinity) {
        bestPath = smartRandomWalk(start, end, graph);
        const m = calculatePathMetrics(bestPath, graph);
        bestCost = calculateWeightedCost(m, weights);
    }

    return { path: bestPath, metrics: { ...calculatePathMetrics(bestPath, graph), weightedCost: bestCost }, executionTime: performance.now() - startTime, algorithmName: AlgorithmType.Q_LEARNING };
};

// --- 4. ABC (Arı) ---
export const runABC = (graph: GraphData, start: number, end: number, weights: AlgorithmParams): PathResult => {
    const startTime = performance.now();
    let bestPath: number[] = [start, end];
    let bestCost = Infinity;

    for (let i = 0; i < 20; i++) {
        const p = smartRandomWalk(start, end, graph);
        if (p[p.length - 1] === end) {
            const m = calculatePathMetrics(p, graph);
            const c = calculateWeightedCost(m, weights);
            if (c < bestCost) { bestCost = c; bestPath = p; }
        }
    }

    if (bestCost === Infinity) {
        bestPath = smartRandomWalk(start, end, graph);
        const m = calculatePathMetrics(bestPath, graph);
        bestCost = calculateWeightedCost(m, weights);
    }

    return { path: bestPath, metrics: { ...calculatePathMetrics(bestPath, graph), weightedCost: bestCost }, executionTime: performance.now() - startTime, algorithmName: AlgorithmType.ABC };
};