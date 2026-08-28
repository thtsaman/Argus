import type { Entity, Relationship, RelationshipStatus } from "@prisma/client";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  cluster?: number;
  isBridge?: boolean;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
  status: RelationshipStatus;
  confidence?: number | null;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function buildGraphData(
  entities: (Entity & { metadata?: unknown })[],
  relationships: Relationship[]
): GraphData {
  const nodeIds = new Set(entities.map((e) => e.id));

  const nodes: GraphNode[] = entities.map((e) => ({
    id: e.id,
    label: e.label,
    type: e.type,
    cluster: (e.metadata as { cluster?: number })?.cluster,
    isBridge: (e.metadata as { bridge?: boolean })?.bridge,
  }));

  const links: GraphLink[] = relationships
    .filter((r) => nodeIds.has(r.sourceId) && nodeIds.has(r.targetId))
    .map((r) => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      type: r.type,
      status: r.status,
      confidence: r.confidence,
    }));

  return { nodes, links };
}

export function findPaths(
  graph: GraphData,
  sourceId: string,
  targetId: string,
  maxDepth = 6
): string[][] {
  if (sourceId === targetId) return [[sourceId]];

  const adjacency = new Map<string, { neighbor: string; linkId: string }[]>();
  for (const link of graph.links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source)!.push({ neighbor: link.target, linkId: link.id });
    adjacency.get(link.target)!.push({ neighbor: link.source, linkId: link.id });
  }

  const paths: string[][] = [];
  const queue: { node: string; path: string[] }[] = [{ node: sourceId, path: [sourceId] }];
  const visited = new Set<string>();

  while (queue.length > 0 && paths.length < 10) {
    const { node, path } = queue.shift()!;
    if (path.length > maxDepth) continue;

    const key = `${node}:${path.length}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const neighbors = adjacency.get(node) || [];
    for (const { neighbor } of neighbors) {
      if (path.includes(neighbor)) continue;

      const newPath = [...path, neighbor];
      if (neighbor === targetId) {
        paths.push(newPath);
      } else {
        queue.push({ node: neighbor, path: newPath });
      }
    }
  }

  return paths.sort((a, b) => a.length - b.length);
}

export function computeBetweenness(
  graph: GraphData
): Map<string, number> {
  const nodes = graph.nodes.map((n) => n.id);
  const scores = new Map<string, number>();
  nodes.forEach((n) => scores.set(n, 0));

  const adjacency = new Map<string, string[]>();
  for (const link of graph.links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source)!.push(link.target);
    adjacency.get(link.target)!.push(link.source);
  }

  for (const source of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    const delta = new Map<string, number>();

    nodes.forEach((n) => {
      pred.set(n, []);
      sigma.set(n, 0);
      dist.set(n, -1);
      delta.set(n, 0);
    });
    sigma.set(source, 1);
    dist.set(source, 0);

    const queue = [source];
    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adjacency.get(v) || []) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) || []) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== source) {
        scores.set(w, scores.get(w)! + delta.get(w)!);
      }
    }
  }

  return scores;
}

export function findBridgeEntities(
  graph: GraphData,
  topN = 5
): { entityId: string; label: string; score: number; description: string }[] {
  const scores = computeBetweenness(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  return [...scores.entries()]
    .map(([entityId, score]) => {
      const node = nodeMap.get(entityId);
      const connections = graph.links.filter(
        (l) => l.source === entityId || l.target === entityId
      ).length;
      return {
        entityId,
        label: node?.label || entityId,
        score,
        description:
          score > 0
            ? `Structural score ${score.toFixed(1)} with ${connections} connections — may link separate groups`
            : `Peripheral entity with ${connections} connections`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
