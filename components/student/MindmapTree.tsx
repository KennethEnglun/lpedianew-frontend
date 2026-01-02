import React, { useId, useMemo } from 'react';

export type MindmapGraph = {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
};

type Props = {
  mindmap: MindmapGraph | null | undefined;
  svgRef?: React.Ref<SVGSVGElement>;
  dataAttr?: string;
};

type TreeNode = { id: string; label: string; children: string[] };

const palette = [
  { stroke: '#7C3AED', fill: '#F3E8FF' }, // purple
  { stroke: '#EF4444', fill: '#FEE2E2' }, // red
  { stroke: '#10B981', fill: '#D1FAE5' }, // green
  { stroke: '#F59E0B', fill: '#FEF3C7' }, // amber
  { stroke: '#3B82F6', fill: '#DBEAFE' }, // blue
  { stroke: '#EC4899', fill: '#FCE7F3' }  // pink
];

const splitLines = (label: string) => {
  const s = String(label || '').trim();
  if (!s) return [''];
  const maxPerLine = 10;
  const lines: string[] = [];
  let i = 0;
  while (i < s.length && lines.length < 2) {
    lines.push(s.slice(i, i + maxPerLine));
    i += maxPerLine;
  }
  if (i < s.length && lines.length === 2) {
    const last = lines[1] || '';
    lines[1] = `${last.slice(0, Math.max(0, maxPerLine - 1))}…`;
  }
  return lines;
};

const buildTree = (mindmap: MindmapGraph | null | undefined) => {
  const nodesRaw = Array.isArray(mindmap?.nodes) ? mindmap!.nodes : [];
  const edgesRaw = Array.isArray(mindmap?.edges) ? mindmap!.edges : [];

  const nodes = nodesRaw
    .map((n) => ({ id: String(n?.id || '').trim(), label: String(n?.label || '').trim() }))
    .filter((n) => n.id && n.label);

  const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
  if (nodesById.size === 0) return null;

  const edges = edgesRaw
    .map((e) => ({ from: String(e?.from || '').trim(), to: String(e?.to || '').trim() }))
    .filter((e) => e.from && e.to && e.from !== e.to && nodesById.has(e.from) && nodesById.has(e.to));

  const parentOf = new Map<string, string>();
  const children = new Map<string, string[]>();

  for (const e of edges) {
    // Keep it tree-like: first parent wins.
    if (parentOf.has(e.to)) continue;
    parentOf.set(e.to, e.from);
    const arr = children.get(e.from) || [];
    arr.push(e.to);
    children.set(e.from, arr);
  }

  const roots = nodes.filter((n) => !parentOf.has(n.id));
  const rootId = (roots[0]?.id || nodes[0]?.id) as string;

  // Attach unreachable nodes to root (so we can still show everything).
  const reachable = new Set<string>();
  const walk = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    const kids = children.get(id) || [];
    for (const c of kids) walk(c);
  };
  walk(rootId);

  for (const n of nodes) {
    if (reachable.has(n.id)) continue;
    const arr = children.get(rootId) || [];
    arr.push(n.id);
    children.set(rootId, arr);
    parentOf.set(n.id, rootId);
    walk(n.id);
  }

  const treeNodes = new Map<string, TreeNode>();
  for (const [id, node] of nodesById.entries()) {
    treeNodes.set(id, { id, label: node.label, children: children.get(id) || [] });
  }

  const treeEdges = Array.from(parentOf.entries()).map(([to, from]) => ({ from, to }));
  return { rootId, nodes: treeNodes, edges: treeEdges };
};

export const MindmapTree: React.FC<Props> = ({ mindmap, svgRef, dataAttr }) => {
  const reactId = useId();
  const shadowId = `mindmap-shadow-${String(dataAttr || 'tree')}-${reactId.replace(/[:]/g, '')}`;

  const computed = useMemo(() => {
    const tree = buildTree(mindmap);
    if (!tree) return null;

    const NODE_W = 210;
    const NODE_H = 64;
    const GAP_X = 48;
    const GAP_Y = 92;
    const PAD_X = 90;
    const PAD_Y = 90;

    const pos = new Map<string, { x: number; y: number; depth: number }>();
    let leafIndex = 0;
    let maxDepth = 0;

    const dfs = (id: string, depth: number): { min: number; max: number; center: number } => {
      maxDepth = Math.max(maxDepth, depth);
      const node = tree.nodes.get(id);
      const kids = node?.children || [];

      if (kids.length === 0) {
        const x = leafIndex;
        leafIndex += 1;
        pos.set(id, { x, y: depth, depth });
        return { min: x, max: x, center: x };
      }

      let min = Infinity;
      let max = -Infinity;
      for (const c of kids) {
        const res = dfs(c, depth + 1);
        min = Math.min(min, res.min);
        max = Math.max(max, res.max);
      }
      const center = Number.isFinite(min) && Number.isFinite(max) ? (min + max) / 2 : 0;
      pos.set(id, { x: center, y: depth, depth });
      return { min, max, center };
    };

    dfs(tree.rootId, 0);

    const leafCount = Math.max(1, leafIndex);
    // Include half node size in the layout so nodes are never clipped by the SVG viewBox.
    const contentW = leafCount * NODE_W + Math.max(0, leafCount - 1) * GAP_X;
    const contentH = (maxDepth + 1) * NODE_H + Math.max(0, maxDepth) * GAP_Y;
    const W = Math.ceil(PAD_X * 2 + contentW);
    const H = Math.ceil(PAD_Y * 2 + contentH);

    const toPx = (x: number) => PAD_X + NODE_W / 2 + x * (NODE_W + GAP_X);
    const toPy = (y: number) => PAD_Y + NODE_H / 2 + y * (NODE_H + GAP_Y);

    const edgeLines = tree.edges
      .map((e) => {
        const p = pos.get(e.from);
        const c = pos.get(e.to);
        if (!p || !c) return null;
        const x1 = toPx(p.x);
        const y1 = toPy(p.y) + NODE_H / 2;
        const x2 = toPx(c.x);
        const y2 = toPy(c.y) - NODE_H / 2;
        return { x1, y1, x2, y2 };
      })
      .filter(Boolean) as Array<{ x1: number; y1: number; x2: number; y2: number }>;

    const nodeBoxes = Array.from(tree.nodes.values())
      .map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const cx = toPx(p.x);
        const cy = toPy(p.y);
        const depth = p.depth;
        const color = palette[depth % palette.length] || palette[0];
        return { id: n.id, label: n.label, cx, cy, depth, color };
      })
      .filter(Boolean) as Array<{ id: string; label: string; cx: number; cy: number; depth: number; color: { stroke: string; fill: string } }>;

    return { W, H, NODE_W, NODE_H, edgeLines, nodeBoxes };
  }, [mindmap]);

  if (!computed) return null;

  return (
    <svg
      ref={svgRef}
      data-mindmap-svg={dataAttr || 'tree'}
      width={computed.W}
      height={computed.H}
      viewBox={`0 0 ${computed.W} ${computed.H}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        {computed.edgeLines.map((e, idx) => (
          <path
            key={idx}
            d={`M ${e.x1} ${e.y1} L ${e.x1} ${(e.y1 + e.y2) / 2} L ${e.x2} ${(e.y1 + e.y2) / 2} L ${e.x2} ${e.y2}`}
            fill="none"
            stroke="#6B7280"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {computed.nodeBoxes.map((n) => {
          const x = n.cx - computed.NODE_W / 2;
          const y = n.cy - computed.NODE_H / 2;
          const lines = splitLines(n.label);
          return (
            <g key={n.id}>
              <rect
                x={x}
                y={y}
                width={computed.NODE_W}
                height={computed.NODE_H}
                rx="18"
                fill={n.color.fill}
                stroke={n.color.stroke}
                strokeWidth="3"
              />
              <text
                x={n.cx}
                y={n.cy - (lines.length === 2 ? 6 : 0)}
                textAnchor="middle"
                fontSize="14"
                fontWeight="800"
                fill="#111827"
              >
                {lines.map((ln, i) => (
                  <tspan key={i} x={n.cx} dy={i === 0 ? 0 : 18}>
                    {ln}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
