import { GraphData, Node, Link } from '../types';

const random = (min: number, max: number) => Math.random() * (max - min) + min;

export const generateGraph = (nodeCount: number = 250): GraphData => {
  const nodes: Node[] = [];
  const links: Link[] = [];
  const adjacency = new Map<number, Link[]>();

  const radius = 10;
  const phi = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < nodeCount; i++) {
    const y = 1 - (i / (nodeCount - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;

    nodes.push({
      id: i,
      x: Math.cos(theta) * radiusAtY * radius,
      y: y * radius,
      z: Math.sin(theta) * radiusAtY * radius,
      processingDelay: random(0.5, 2.0),
      reliability: random(0.99, 0.9999),
    });
    adjacency.set(i, []);
  }

  // --- KRİTİK DÜZELTME: BAĞLANTI SAYISI ---
  // 1000 node için her düğümün en az 5-8 komşusu olsun ki kopukluk olmasın
  const neighborCountMin = nodeCount > 500 ? 5 : 3;
  const neighborCountMax = nodeCount > 500 ? 9 : 6;

  for (let i = 0; i < nodeCount; i++) {
    const nodeA = nodes[i];

    // Mesafeye göre en yakınları bul
    const distances = nodes
      .map((n) => ({ id: n.id, dist: (n.x - nodeA.x) ** 2 + (n.y - nodeA.y) ** 2 + (n.z - nodeA.z) ** 2 }))
      .filter((d) => d.id !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, Math.floor(random(neighborCountMin, neighborCountMax)));

    distances.forEach((d) => {
      const existing = links.find(l => (l.source === i && l.target === d.id) || (l.source === d.id && l.target === i));
      if (!existing) {
        const link: Link = {
          source: i, target: d.id,
          bandwidth: random(100, 1000),
          propagationDelay: random(2, 10),
          reliability: random(0.98, 0.9999)
        };
        links.push(link);
        adjacency.get(i)?.push(link);
        adjacency.get(d.id)?.push({ ...link, source: d.id, target: i });
      }
    });
  }

  return { nodes, links, adjacency };
};

export const calculatePathMetrics = (path: number[], graph: GraphData) => {
  let totalDelay = 0;
  let reliabilityLogSum = 0;
  let resourceCostSum = 0;

  if (path.length < 2) return { totalDelay: 0, totalReliability: 0, reliabilityCost: 100, resourceCost: 100 };

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const node = graph.nodes[nodeId];
    if (!node) continue;

    if (i !== 0 && i !== path.length - 1) totalDelay += node.processingDelay;
    reliabilityLogSum += -Math.log(node.reliability);

    if (i < path.length - 1) {
      const nextId = path[i + 1];
      // Link bulamazsa varsayılan değer ekle (Infinity hatasını önlemek için)
      const link = graph.adjacency.get(nodeId)?.find(l => l.target === nextId) || { propagationDelay: 5, reliability: 0.99, bandwidth: 500 };

      totalDelay += link.propagationDelay;
      reliabilityLogSum += -Math.log(link.reliability);
      resourceCostSum += (10000 / link.bandwidth);
    }
  }

  return {
    totalDelay,
    totalReliability: Math.exp(-reliabilityLogSum),
    reliabilityCost: reliabilityLogSum * 50,
    resourceCost: resourceCostSum
  };
};

export const calculateWeightedCost = (metrics: any, params: any) => {
  return (params.wDelay * metrics.totalDelay) + (params.wReliability * metrics.reliabilityCost) + (params.wResource * metrics.resourceCost);
};