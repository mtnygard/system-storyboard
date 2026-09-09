import { useEffect, useRef, useState, type DragEvent } from "react";
import type { Interaction, Scenario, State } from "../domain/model";
import { moveVisibleTo } from "../domain/interaction-views";

type DropTarget = { id: string; side: "before" | "after" };
type DragSource = { id: string; scenarioId: string; state: State };

export function useInteractionRowDrag(
  scenario: Scenario,
  visible: Interaction[],
  state: State,
  onChange: (scenario: Scenario) => void,
  onSelect: (id: string) => void,
) {
  const source = useRef<DragSource | undefined>(undefined);
  const [draggingId, setDraggingId] = useState<string>();
  const [target, setTarget] = useState<DropTarget>();
  function finish() {
    source.current = undefined;
    setDraggingId(undefined);
    setTarget(undefined);
  }
  useEffect(() => {
    finish();
  }, [scenario.id, state]);
  const active = () =>
    source.current?.scenarioId === scenario.id &&
    source.current.state === state &&
    visible.some((i) => i.id === source.current?.id);

  function start(id: string, event: DragEvent<HTMLButtonElement>) {
    source.current = { id, scenarioId: scenario.id, state };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-studio-interaction", id);
    const row = event.currentTarget.closest("tr");
    if (row && event.dataTransfer.setDragImage) {
      const box = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        row,
        event.clientX - box.left,
        event.clientY - box.top,
      );
    }
    setDraggingId(id);
    onSelect(id);
  }
  function position(
    id: string,
    event: DragEvent<HTMLTableRowElement>,
  ): DropTarget {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      id,
      side: event.clientY < box.top + box.height / 2 ? "before" : "after",
    };
  }
  function over(id: string, event: DragEvent<HTMLTableRowElement>) {
    if (!active()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const next = position(id, event);
    setTarget((previous) =>
      previous?.id === next.id && previous.side === next.side ? previous : next,
    );
  }
  function drop(id: string, event: DragEvent<HTMLTableRowElement>) {
    if (!active()) return;
    event.preventDefault();
    const sourceId = source.current!.id;
    const from = visible.findIndex((i) => i.id === sourceId);
    const destination = position(id, event);
    const boundary =
      visible.findIndex((i) => i.id === id) +
      (destination.side === "after" ? 1 : 0);
    const to = boundary - (from < boundary ? 1 : 0);
    const interactions = moveVisibleTo(scenario, visible, from, to);
    finish();
    if (interactions !== scenario.interactions) {
      onChange({ ...scenario, interactions });
      onSelect(sourceId);
    }
  }
  return { draggingId, target, start, over, drop, finish };
}
