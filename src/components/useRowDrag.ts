import { useEffect, useRef, useState, type DragEvent } from "react";

export type DropSide = "before" | "after";
type Item = { id: string; group?: string };
type DropTarget = { id: string; side: DropSide };
type DragSource = Item & { scope: string };

/** Handle-only row dragging, optionally restricted to a group within the view. */
export function useRowDrag(
  scope: string,
  items: readonly Item[],
  onMove: (from: string, to: string, side: DropSide) => void,
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
  }, [scope]);
  function accepts(id: string) {
    const current = source.current;
    const from = items.find((item) => item.id === current?.id);
    const to = items.find((item) => item.id === id);
    return (
      current?.scope === scope &&
      from &&
      to &&
      from.group === current.group &&
      to.group === current.group
    );
  }
  function start(id: string, event: DragEvent<HTMLButtonElement>) {
    const item = items.find((item) => item.id === id);
    if (!item) {
      event.preventDefault();
      return;
    }
    source.current = { ...item, scope };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-studio-row", id);
    const row = event.currentTarget.closest("[data-reorder-row]");
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
  function position(id: string, event: DragEvent<HTMLElement>): DropTarget {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      id,
      side: event.clientY < box.top + box.height / 2 ? "before" : "after",
    };
  }
  function over(id: string, event: DragEvent<HTMLElement>) {
    if (!accepts(id)) {
      if (source.current) event.dataTransfer.dropEffect = "none";
      setTarget(undefined);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const next = position(id, event);
    setTarget((previous) =>
      previous?.id === next.id && previous.side === next.side ? previous : next,
    );
  }
  function drop(id: string, event: DragEvent<HTMLElement>) {
    if (!accepts(id)) {
      finish();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourceId = source.current!.id;
    const destination = position(id, event);
    finish();
    onMove(sourceId, id, destination.side);
  }
  return { draggingId, target, start, over, drop, finish };
}
