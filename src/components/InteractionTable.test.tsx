import { useState } from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InteractionTable } from "./InteractionTable";
import { newScenario, newInteraction, type Scenario } from "../domain/model";

const transfer = () => ({
  setData: vi.fn(),
  setDragImage: vi.fn(),
  effectAllowed: "",
  dropEffect: "",
});
function sendDrag(
  type: "dragStart" | "dragOver" | "drop" | "dragEnd",
  element: HTMLElement,
  dataTransfer: ReturnType<typeof transfer>,
  y = 0,
) {
  const event = createEvent[type](element, { dataTransfer });
  Object.defineProperty(event, "clientY", { value: y });
  Object.defineProperty(event, "clientX", { value: 0 });
  fireEvent(element, event);
}
const handle = (step: number) =>
  screen.getByRole("button", { name: `Drag interaction ${step} to reorder` });
function setup() {
  const initial = newScenario();
  initial.mode = "transition";
  initial.interactions = [
    "First",
    "Hidden A",
    "Middle",
    "Hidden B",
    "Last",
  ].map((action, index) => ({
    ...newInteraction("transition"),
    action,
    current: index % 2 === 0,
    targetOverrides: { action: `Target ${action}` },
  }));
  let latest: Scenario = initial;
  const changed = vi.fn();
  const select = vi.fn();
  function Harness() {
    const [scenario, setScenario] = useState(initial);
    const [state, setState] = useState<"current" | "target" | "transition">(
      "current",
    );
    latest = scenario;
    return (
      <InteractionTable
        scenario={scenario}
        editingState={state}
        onEditingState={setState}
        catalog={[]}
        onSelect={select}
        onCatalog={vi.fn()}
        onChange={(next) => {
          changed(next);
          setScenario(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { initial, latest: () => latest, changed, select };
}

it("shows a drop indicator and inserts a dragged row after a later row without moving hidden slots", () => {
  const { initial, latest, changed, select } = setup();
  const dataTransfer = transfer();
  const source = handle(1);
  const destination = handle(3).closest("tr")!;
  vi.spyOn(destination, "getBoundingClientRect").mockReturnValue({
    top: 100,
    height: 60,
  } as DOMRect);
  sendDrag("dragStart", source, dataTransfer);
  sendDrag("dragOver", destination, dataTransfer, 150);
  expect(dataTransfer.effectAllowed).toBe("move");
  expect(destination).toHaveClass("drop-after");
  expect(source.closest("tr")).toHaveClass("dragging");
  sendDrag("drop", destination, dataTransfer, 150);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(latest().interactions).toEqual([
    initial.interactions[2],
    initial.interactions[1],
    initial.interactions[4],
    initial.interactions[3],
    initial.interactions[0],
  ]);
  expect(
    screen.getByRole("textbox", { name: "Action for step 3" }),
  ).toHaveValue("First");
  expect(select).toHaveBeenLastCalledWith(initial.interactions[0].id);
  expect(document.querySelector(".drop-after, .dragging")).toBeNull();
});
it("inserts before an earlier row and keeps target overrides attached to their original records", () => {
  const { initial, latest } = setup();
  const dataTransfer = transfer();
  const destination = handle(1).closest("tr")!;
  vi.spyOn(destination, "getBoundingClientRect").mockReturnValue({
    top: 100,
    height: 60,
  } as DOMRect);
  sendDrag("dragStart", handle(3), dataTransfer);
  sendDrag("dragOver", destination, dataTransfer, 105);
  expect(destination).toHaveClass("drop-before");
  sendDrag("drop", destination, dataTransfer, 105);
  expect(latest().interactions).toEqual([
    initial.interactions[4],
    initial.interactions[1],
    initial.interactions[0],
    initial.interactions[3],
    initial.interactions[2],
  ]);
});
it("ignores external drops, same-position drops and canceled drags", () => {
  const { changed } = setup();
  const dataTransfer = transfer();
  sendDrag("drop", handle(2).closest("tr")!, dataTransfer);
  sendDrag("dragStart", handle(1), dataTransfer);
  sendDrag("drop", handle(1).closest("tr")!, dataTransfer);
  sendDrag("dragStart", handle(1), dataTransfer);
  sendDrag("dragOver", handle(3).closest("tr")!, dataTransfer);
  sendDrag("dragEnd", handle(1), dataTransfer);
  sendDrag("drop", handle(3).closest("tr")!, dataTransfer);
  expect(changed).not.toHaveBeenCalled();
  expect(
    document.querySelector(".drop-before, .drop-after, .dragging"),
  ).toBeNull();
});
it("cancels dragging if the editing state changes and keeps text fields non-draggable", async () => {
  const user = userEvent.setup();
  const { changed } = setup();
  const dataTransfer = transfer();
  sendDrag("dragStart", handle(1), dataTransfer);
  await user.click(screen.getByRole("button", { name: "Target" }));
  sendDrag("drop", handle(3).closest("tr")!, dataTransfer);
  expect(changed).not.toHaveBeenCalled();
  expect(
    screen.getByRole("textbox", { name: "Action for step 1" }),
  ).not.toHaveAttribute("draggable");
  expect(handle(1).closest("tr")).not.toHaveAttribute("draggable");
});
