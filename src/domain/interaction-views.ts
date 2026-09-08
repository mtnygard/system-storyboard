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
  const other = visible[index + direction];
  if (!other) return scenario.interactions;
  const items = [...scenario.interactions];
  const a = items.findIndex((i) => i.id === visible[index].id);
  const b = items.findIndex((i) => i.id === other.id);
  [items[a], items[b]] = [items[b], items[a]];
  return items;
}
