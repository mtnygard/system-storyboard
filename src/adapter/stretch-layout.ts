import type { ArchitectureLayout, PlacedLane } from "./renderer-internals";
import {
  CONTENT_TOP,
  LANE_TOP,
  LANE_BOTTOM_PADDING,
  LANE_PADDING_X,
  ROW_GAP,
} from "./renderer-internals";

/** Allocate content space; headers, boundary padding and fixed cards keep their size. */
export function stretchParticipants(
  layout: ArchitectureLayout,
  boundaries: PlacedLane[],
  horizontal: ReadonlySet<string>,
  stretch: ReadonlySet<string>,
  participantOrder: readonly string[],
) {
  const order = new Map(participantOrder.map((id, index) => [id, index]));
  for (const { lane, box } of boundaries) {
    const members = layout.nodes
      .filter((p) => p.node.lane === lane.id)
      .sort((a, b) => order.get(a.node.id)! - order.get(b.node.id)!);
    const flexible = members.filter((p) => stretch.has(p.node.id));
    if (!flexible.length) continue;
    if (horizontal.has(lane.id)) {
      for (const p of flexible) {
        p.box.x = box.x + LANE_PADDING_X;
        p.box.width = box.width - LANE_PADDING_X * 2;
      }
      continue;
    }
    const top = box.y + CONTENT_TOP - LANE_TOP;
    const available =
      box.height - (CONTENT_TOP - LANE_TOP) - LANE_BOTTOM_PADDING;
    const fixed = members
      .filter((p) => !stretch.has(p.node.id))
      .reduce((sum, p) => sum + p.box.height, 0);
    const weight = flexible.reduce((sum, p) => sum + p.box.height, 0);
    const room = Math.max(
      weight,
      available - fixed - ROW_GAP * (members.length - 1),
    );
    let y = top;
    for (const p of members) {
      p.box.y = y;
      p.box.x = box.x + LANE_PADDING_X;
      p.box.width = box.width - LANE_PADDING_X * 2;
      if (stretch.has(p.node.id)) p.box.height = (room * p.box.height) / weight;
      y += p.box.height + ROW_GAP;
    }
  }
}
