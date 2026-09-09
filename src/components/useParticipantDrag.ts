import type { Scenario } from "../domain/model";
import {
  moveParticipant,
  moveParticipantToBoundary,
} from "../domain/participant-order";
import { useRowDrag } from "./useRowDrag";

// Separate namespaces keep boundary and participant IDs from colliding.
export const participantDragId = (id: string) =>
  JSON.stringify(["participant", id]);
export const boundaryDragId = (id: string) => JSON.stringify(["boundary", id]);

export function useParticipantDrag(
  scenario: Scenario,
  onChange: (scenario: Scenario) => void,
  onSelect: (id: string) => void,
) {
  const participants = new Map(
    scenario.participantPlacements
      .filter((p) => scenario.boundaries.some((b) => b.id === p.boundaryId))
      .map((p) => [participantDragId(p.participantId), p.participantId]),
  );
  const boundaries = new Map(
    scenario.boundaries.map((b) => [boundaryDragId(b.id), b.id]),
  );
  return useRowDrag(
    scenario.id,
    [...participants.keys(), ...boundaries.keys()].map((id) => ({ id })),
    (sourceKey, targetKey, side) => {
      const sourceId = participants.get(sourceKey);
      if (!sourceId) return;
      const targetId = participants.get(targetKey);
      const boundaryId = boundaries.get(targetKey);
      const placements = scenario.participantPlacements;
      const participantPlacements = targetId
        ? moveParticipant(placements, sourceId, targetId, side)
        : boundaryId
          ? moveParticipantToBoundary(placements, sourceId, boundaryId)
          : placements;
      if (participantPlacements !== placements) {
        onChange({ ...scenario, participantPlacements });
        onSelect(sourceId);
      }
    },
    (key) => {
      const id = participants.get(key);
      if (id) onSelect(id);
    },
  );
}
