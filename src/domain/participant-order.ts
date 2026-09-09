import type { Placement } from "./model";

/** Insert beside a participant, adopting its boundary and retaining placement details. */
export function moveParticipant(
  placements: Placement[],
  sourceId: string,
  targetId: string,
  side: "before" | "after",
): Placement[] {
  const source = placements.find((p) => p.participantId === sourceId);
  const target = placements.find((p) => p.participantId === targetId);
  if (!source || !target || !target.boundaryId || sourceId === targetId)
    return placements;
  if (source.boundaryId !== target.boundaryId) {
    const result = placements.filter((p) => p !== source);
    const to = result.indexOf(target) + (side === "after" ? 1 : 0);
    result.splice(to, 0, { ...source, boundaryId: target.boundaryId });
    return result;
  }
  const members = placements.filter((p) => p.boundaryId === source.boundaryId);
  const from = members.indexOf(source);
  const boundary = members.indexOf(target) + (side === "after" ? 1 : 0);
  const to = boundary - (from < boundary ? 1 : 0);
  if (from === to) return placements;
  members.splice(from, 1);
  members.splice(to, 0, source);
  let next = 0;
  return placements.map((p) =>
    p.boundaryId === source.boundaryId ? members[next++] : p,
  );
}

/** Move to the end of a boundary, including an empty one. */
export function moveParticipantToBoundary(
  placements: Placement[],
  sourceId: string,
  boundaryId: string,
): Placement[] {
  const source = placements.find((p) => p.participantId === sourceId);
  if (!source || !boundaryId) return placements;
  const members = placements.filter((p) => p.boundaryId === boundaryId);
  const last = members[members.length - 1];
  if (last)
    return moveParticipant(placements, sourceId, last.participantId, "after");
  return [...placements.filter((p) => p !== source), { ...source, boundaryId }];
}
