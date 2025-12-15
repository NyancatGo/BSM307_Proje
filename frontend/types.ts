export interface Node {
  id: number;
  x: number;
  y: number;
  z: number;
  processingDelay: number; // ms
  reliability: number; // 0.95 - 0.999
}

export interface Link {
  source: number;
  target: number;
  bandwidth: number; // Mbps
  propagationDelay: number; // ms
  reliability: number; // 0.95 - 0.999
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
  adjacency: Map<number, Link[]>;
}

export interface AlgorithmParams {
  wDelay: number;
  wReliability: number;
  wResource: number;
}

export interface PathResult {
  path: number[]; // Array of Node IDs
  metrics: {
    totalDelay: number;
    totalReliability: number;
    resourceCost: number;
    weightedCost: number;
  };
  executionTime: number; // ms
  algorithmName: string;
}

export enum AlgorithmType {
  GENETIC = 'Genetik Algoritma (GA)',
  ACO = 'Karınca Kolonisi Optimizasyonu (ACO)',
  Q_LEARNING = 'Q-Öğrenme (Q-Learning)',
  ABC = 'Yapay Arı Kolonisi (ABC)',
}