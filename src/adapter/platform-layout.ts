import { stretchParticipants } from "./stretch-layout";
import { routeAroundParticipants } from "./stretch-routing";
import type { GraphDoc, GraphNode } from "@coldtea/pr-lens-schema";
import { resolveScope } from "@coldtea/pr-lens-renderer";
import {
  layoutArchitecture,
  channelTraffic,
  routeEdges,
  type GapExpansions,
  type PlacedLane,
  LANE_TOP,
  CONTENT_TOP,
  LANE_PADDING_X,
  LANE_GAP,
  LANE_BOTTOM_PADDING,
  ROW_GAP,
  TRACK_CLEARANCE,
  TRACK_PITCH_MIN,
} from "./renderer-internals";

/** Keep routing on a rectangular grid while painting platform lanes as bands. */
export function layoutPlatforms(
  doc: GraphDoc,
  horizontalIds: readonly string[],
  stretchIds: readonly string[] = [],
) {
  const stretch = new Set(stretchIds);
  const horizontal = new Set(horizontalIds);
  const graph = resolveScope(doc, { kind: "all" });
  const order = doc.layout?.laneOrder ?? doc.lanes.map((lane) => lane.id);
  const ordered = [...graph.lanes].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const platforms = ordered.filter(
    (lane) =>
      horizontal.has(lane.id) &&
      graph.nodes.some((node) => node.lane === lane.id),
  );
  const verticalNodes = graph.nodes.filter(
    (node) => !horizontal.has(node.lane),
  );
  const verticalIds = new Set(verticalNodes.map((node) => node.id));
  const vertical = {
    ...graph,
    lanes: ordered.filter((lane) => !horizontal.has(lane.id)),
    nodes: verticalNodes,
    edges: graph.edges.filter(
      (edge) => verticalIds.has(edge.from) && verticalIds.has(edge.to),
    ),
  };
  const base = layoutArchitecture(vertical, doc.layout);
  const maxPlatformSize = Math.max(
    1,
    ...platforms.map(
      (lane) => graph.nodes.filter((node) => node.lane === lane.id).length,
    ),
  );
  const columns = base.lanes.length || Math.min(3, maxPlatformSize);
  // Virtual columns exist only in the geometry scaffold, never in exports/atlas.
  const lanes = base.lanes.length
    ? base.lanes.map(({ lane }) => lane)
    : Array.from({ length: columns }, (_, index) => ({
        id: `platform-column-${index}`,
        label: "",
        order: index,
      }));
  const ranks: Record<string, number> = Object.fromEntries(
    base.nodes.map((node) => [node.node.id, node.row]),
  );
  const scaffoldNodes: GraphNode[] = verticalNodes.map((node) => ({
    ...node,
    delta: "unchanged",
  }));
  // A vertical stretch lane uses ordered full-width rows, including fixed cards.
  for (const { lane } of base.lanes) {
    const members = verticalNodes.filter((node) => node.lane === lane.id);
    if (members.some((node) => stretch.has(node.id))) {
      members.forEach((node, index) => {
        ranks[node.id] = index;
      });
    }
  }
  const verticalRows = new Set(Object.values(ranks)).size;
  let row = verticalRows;
  const bands = platforms.map((lane) => {
    const members = graph.nodes.filter((node) => node.lane === lane.id);
    const start = row;
    let column = 0;
    for (const node of members) {
      if (stretch.has(node.id) && column > 0) {
        row++;
        column = 0;
      }
      ranks[node.id] = row;
      scaffoldNodes.push({
        ...node,
        delta: "unchanged",
        lane: lanes[column].id,
      });
      if (stretch.has(node.id) || ++column === columns) {
        row++;
        column = 0;
      }
    }
    if (column > 0) row++;
    return { lane, start, end: row - 1 };
  });
  // Keep empty geometry columns when every platform card occupies its own row.
  for (const lane of lanes) {
    if (scaffoldNodes.some((node) => node.lane === lane.id)) continue;
    let id = `studio-spacer-${lane.id}`;
    while (graph.nodes.some((node) => node.id === id)) id += "-";
    ranks[id] = 0;
    scaffoldNodes.push({
      ...graph.nodes[0],
      id,
      lane: lane.id,
      delta: "unchanged",
    });
  }
  const scaffold = { ...graph, lanes, nodes: scaffoldNodes, edges: [] };
  const originals = new Map(graph.nodes.map((node) => [node.id, node]));
  const headerGap = CONTENT_TOP - LANE_TOP + LANE_GAP;
  function arrange(extra: GapExpansions) {
    const bandSpace = new Map(extra.bands);
    // Reserve the band header in addition to whatever space routing requires.
    bands
      .filter((band) => band.start > 0)
      .forEach((band) => {
        bandSpace.set(band.start, (bandSpace.get(band.start) ?? 0) + headerGap);
      });
    const layout = layoutArchitecture(
      scaffold,
      {
        direction: "right",
        laneOrder: lanes.map((lane) => lane.id),
        rank: ranks,
      },
      { ...extra, bands: bandSpace },
    );
    layout.nodes = layout.nodes
      .filter((placed) => originals.has(placed.node.id))
      .map((placed) => ({
        ...placed,
        node: originals.get(placed.node.id)!,
      }));
    const left = layout.lanes[0].box.x;
    const last = layout.lanes.at(-1)!.box;
    const width = last.x + last.width - left;
    const visibleLanes: PlacedLane[] = base.lanes.map(({ lane }, index) => {
      const lastRow = layout.grid.rows[verticalRows - 1];
      return {
        lane,
        box: {
          ...layout.lanes[index].box,
          height: lastRow.top + lastRow.height + LANE_BOTTOM_PADDING - LANE_TOP,
        },
      };
    });
    for (const band of bands) {
      const top = layout.grid.rows[band.start].top - (CONTENT_TOP - LANE_TOP);
      const bottom = layout.grid.rows[band.end];
      visibleLanes.push({
        lane: band.lane,
        box: {
          x: left,
          y: top,
          width,
          height: bottom.top + bottom.height + LANE_BOTTOM_PADDING - top,
        },
      });
    }
    stretchParticipants(
      layout,
      visibleLanes,
      horizontal,
      stretch,
      graph.nodes.map((node) => node.id),
    );
    return { layout, visibleLanes };
  }
  let extra: GapExpansions = { corridors: new Map(), bands: new Map() };
  let arranged = arrange(extra);
  for (let round = 0; round < 3; round++) {
    const traffic = channelTraffic(graph.edges, arranged.layout);
    const needed = (count: number, available: number) =>
      Math.max(
        0,
        (count - 1) * TRACK_PITCH_MIN + TRACK_CLEARANCE * 2 - available,
      );
    extra = {
      corridors: new Map(
        [...traffic.corridors].map(([index, count]) => [
          index,
          needed(count, LANE_PADDING_X * 2 + LANE_GAP),
        ]),
      ),
      bands: new Map(
        [...traffic.bands].map(([index, count]) => [
          index,
          needed(count, index === row ? LANE_BOTTOM_PADDING : ROW_GAP),
        ]),
      ),
    };
    arranged = arrange(extra);
  }
  const routed = routeEdges(graph.edges, arranged.layout);
  return {
    ...arranged,
    routed: stretchIds.length
      ? routeAroundParticipants(routed, arranged.layout.nodes)
      : routed,
  };
}
