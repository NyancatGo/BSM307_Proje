// src/types.ts

export interface Node {
  id: number;
  x: number;
  y: number;
  z: number;
  processingDelay?: number;
  reliability?: number;
  connections?: number[];
}

export interface Link {
  source: number;
  target: number;
  bandwidth: number;
  propagationDelay: number;
  reliability: number;
  score?: number;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
  adjacency: Map<number, Link[]>;
}

export enum AlgorithmType {
  GENETIC = 'Genetic',
  ACO = 'ACO',
  Q_LEARNING = 'Q-Learning',
  ABC = 'ABC'
}

export interface AlgorithmParams {
  // Sliderlar için gerekli alanlar
  wDelay?: number;
  wReliability?: number;
  wResource?: number;

  // Algoritma parametreleri
  generations?: number;
  populationSize?: number;
  mutationRate?: number;
  iterations?: number;
  ants?: number;
  alpha?: number;
  beta?: number;
  evaporation?: number;
  episodes?: number;
  learningRate?: number;
  discountFactor?: number;
  epsilon?: number;
  limit?: number;
}

export interface PathMetrics {
  weightedCost: number;
  totalDelay: number;
  totalReliability: number;
  resourceCost: number;
  reliabilityCost?: number;
  hopCount?: number;
}

export interface PathResult {
  path: number[];
  metrics: PathMetrics;
  executionTime: number;
  algorithmName?: string;
  score?: number;
}

export type ResultType = PathResult;