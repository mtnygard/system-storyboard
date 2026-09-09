import type { Interaction, Scenario, State } from "./model";

export const interactionsFor = (scenario: Scenario, state: State) =>
  scenario.interactions.filter((i) => state === "transition" || i[state]);

/** Initialize once, preserving identities so unchanged steps need only one edit. */
export function populateTarget(scenario: Scenario): Scenario {
  if (scenario.interactions.some((i) => i.target)) return scenario;
  return {
    ...scenario,
    participantPlacements: scenario.participantPlacements.map((p) =>
      p.current ? { ...p, target: true } : p,
    ),
    interactions: scenario.interactions.map((i) =>
      i.current ? { ...i, target: true } : i,
    ),
  };
}

/** Reorder visible slots without dropping or moving hidden rows. */
export function moveVisible(
  scenario: Scenario,
  visible: Interaction[],
  index: number,
  direction: number,
): Interaction[] {
  return moveVisibleTo(scenario, visible, index, index + direction);
}

/** Insert at a visible position while preserving raw records and hidden slots. */
export function moveVisibleTo(
  scenario: Scenario,
  visible: readonly Interaction[],
  from: number,
  to: number,
): Interaction[] {
  if (from === to || !visible[from] || !visible[to])
    return scenario.interactions;
  const ids = visible.map((i) => i.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  const included = new Set(ids);
  const originals = new Map(scenario.interactions.map((i) => [i.id, i]));
  if (ids.some((id) => !originals.has(id))) return scenario.interactions;
  let next = 0;
  return scenario.interactions.map((i) =>
    included.has(i.id) ? originals.get(ids[next++])! : i,
  );
}
