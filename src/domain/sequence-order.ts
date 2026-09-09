import type { Interaction } from "./model";

type Connection = Pick<
  Interaction,
  "fromParticipantId" | "toParticipantId" | "pattern"
>;

/**
 * Maximize left-to-right non-return messages, with first appearance in the
 * request flow breaking ties. Replies never influence column order. Participants
 * outside that flow retain their relative placement order at the end.
 * The sequence schema permits at most 12 participants: subset DP is bounded
 * to 4096 states, rather than searching all participant permutations.
 */
export function sequenceParticipantOrder(
  participantIds: readonly string[],
  interactions: readonly Connection[],
): string[] {
  const included = new Set(participantIds);
  const connections = interactions.filter(
    (i) =>
      i.pattern !== "return" &&
      i.fromParticipantId !== i.toParticipantId &&
      included.has(i.fromParticipantId) &&
      included.has(i.toParticipantId),
  );
  const encountered = new Set<string>();
  for (const i of interactions) {
    if (i.pattern === "return") continue;
    for (const id of [i.fromParticipantId, i.toParticipantId]) {
      if (included.has(id)) encountered.add(id);
    }
  }
  const active = [...encountered];
  const unused = participantIds.filter((id) => !encountered.has(id));
  // Oversized documents are rejected by schema validation; don't allocate an
  // exponential table for them while compiling the validation message.
  if (active.length > 12) return [...active, ...unused];
  const positions = new Map(active.map((id, index) => [id, index]));
  const weights = active.map(() => new Int32Array(active.length));
  for (const i of connections) {
    weights[positions.get(i.fromParticipantId)!][
      positions.get(i.toParticipantId)!
    ] += 1;
  }
  const full = (1 << active.length) - 1;
  const score = new Int32Array(full + 1);
  const choice = new Int8Array(full + 1);
  for (let mask = full - 1; mask >= 0; mask--) {
    let best = -1;
    for (let next = 0; next < active.length; next++) {
      const bit = 1 << next;
      if (mask & bit) continue;
      let candidate = score[mask | bit];
      for (let from = 0; from < active.length; from++) {
        if (mask & (1 << from)) candidate += weights[from][next];
      }
      if (candidate > best) {
        best = candidate;
        choice[mask] = next;
      }
    }
    score[mask] = best;
  }
  const ordered = [];
  for (let mask = 0; mask !== full; ) {
    const next = choice[mask];
    ordered.push(active[next]);
    mask |= 1 << next;
  }
  return [...ordered, ...unused];
}
