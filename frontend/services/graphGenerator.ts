import { GraphData, Node, Link } from '../types';

// Helper to get random number in range
const random = (min: number, max: number) => Math.random() * (max - min) + min;

export const generateGraph = (nodeCount: number = 250): GraphData => {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const adjacency = new Map<number, Link[]>();

  // 1. Generate Nodes on a Sphere (Radius 10)
  const radius = 10;
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

  for (let i = 0; i < nodeCount; i++) {
    const y = 1 - (i / (nodeCount - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y); // Radius at y
    const theta = phi * i;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    nodes.push({
      id: i,
      x: x * radius,
      y: y * radius,
      z: z * radius,
      processingDelay: random(0.5, 2.0),
      reliability: random(0.95, 0.999),
    });
    adjacency.set(i, []);
  }

  // 2. Generate Links (Geometric Distance based to ensure clean 3D look + Randomness)
  // We connect nodes to their nearest neighbors to form a mesh, plus some long range links
  for (let i = 0; i < nodeCount; i++) {
    const nodeA = nodes[i];
    
    // Connect to 3-5 nearest neighbors
    const distances = nodes
      .map((n) => ({
        id: n.id,
        dist: Math.sqrt(
          (n.x - nodeA.x) ** 2 + (n.y - nodeA.y) ** 2 + (n.z - nodeA.z) ** 2
        ),
      }))
      .filter((d) => d.id !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, Math.floor(random(3, 6))); // Degree of node

    distances.forEach((d) => {
        // Avoid duplicate links
        const existing = links.find(l => (l.source === i && l.target === d.id) || (l.source === d.id && l.target === i));
        if (!existing) {
            const link: Link = {
                source: i,
                target: d.id,
                bandwidth: random(100, 1000),
                propagationDelay: random(3, 15),
                reliability: random(0.95, 0.999)
            };
            links.push(link);
            adjacency.get(i)?.push(link);
            // Undirected graph logic for adjacency, but link structure stores source/target
            adjacency.get(d.id)?.push({ ...link, source: d.id, target: i });
        }
    });
  }

  return { nodes, links, adjacency };
};

// Fitness Calculation
export const calculatePathMetrics = (path: number[], graph: GraphData) => {
  let totalDelay = 0;
  let reliabilityLogSum = 0; // -log(R)
  let resourceCostSum = 0;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const node = graph.nodes[nodeId];

    // Node Processing Delay (except source/dest usually, but PDF says intermediate. 
    // Simplified: Add all node delays for now or exclude S/D if strict).
    // PDF: "intermediate nodes processing delay". 
    if (i !== 0 && i !== path.length - 1) {
        totalDelay += node.processingDelay;
    }
    
    // Node Reliability
    reliabilityLogSum += -Math.log(node.reliability);

    // Link Metrics (between i and i+1)
    if (i < path.length - 1) {
      const nextNodeId = path[i + 1];
      const link = graph.adjacency.get(nodeId)?.find(l => l.target === nextNodeId);
      
      if (link) {
        totalDelay += link.propagationDelay;
        reliabilityLogSum += -Math.log(link.reliability);
        // Resource Cost = 1 Gbps / Bandwidth (Mbps). 1Gbps = 1000Mbps.
        resourceCostSum += (1000 / link.bandwidth);
      }
    }
  }

  return {
    totalDelay, // Minimize
    totalReliability: Math.exp(-reliabilityLogSum), // Maximize (display purposes)
    reliabilityCost: reliabilityLogSum, // Minimize
    resourceCost: resourceCostSum // Minimize
  };
};

export const calculateWeightedCost = (
    metrics: { totalDelay: number; reliabilityCost: number; resourceCost: number },
    params: { wDelay: number; wReliability: number; wResource: number }
) => {
    // Normalization is usually needed because Delay is ~50ms, Reliability ~0.05, Resource ~5.
    // For this project, we assume the user adjusts weights to balance the raw numbers 
    // OR we do simple normalization. PDF implies direct Weighted Sum.
    
    return (
        params.wDelay * metrics.totalDelay +
        params.wReliability * metrics.reliabilityCost + // using Cost (-log R)
        params.wResource * metrics.resourceCost
    );
};
