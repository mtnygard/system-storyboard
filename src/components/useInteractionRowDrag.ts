import type { Interaction, Scenario, State } from "../domain/model";
import { moveVisibleTo } from "../domain/interaction-views";
import { useRowDrag } from "./useRowDrag";

export function useInteractionRowDrag(
  scenario: Scenario,
  visible: Interaction[],
  state: State,
  onChange: (scenario: Scenario) => void,
  onSelect: (id: string) => void,
) {
  return useRowDrag(
    JSON.stringify([scenario.id, state]),
    visible.map((i) => ({ id: i.id })),
    (sourceId, targetId, side) => {
      const from = visible.findIndex((i) => i.id === sourceId);
      const boundary =
        visible.findIndex((i) => i.id === targetId) +
        (side === "after" ? 1 : 0);
      const to = boundary - (from < boundary ? 1 : 0);
      const interactions = moveVisibleTo(scenario, visible, from, to);
      if (interactions !== scenario.interactions) {
        onChange({ ...scenario, interactions });
        onSelect(sourceId);
      }
    },
    onSelect,
  );
}
