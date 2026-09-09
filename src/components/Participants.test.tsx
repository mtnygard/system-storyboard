import { useState } from "react";
import { expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  createEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Participants } from "./Participants";
import {
  newParticipant,
  newPlacement,
  newScenario,
  type Scenario,
} from "../domain/model";

it("reorders within a boundary without moving other placements or changing selection", async () => {
  const user = userEvent.setup();
  const initial = newScenario();
  const boundary = initial.boundaries[0];
  initial.boundaries.push({
    ...boundary,
    id: "other",
    name: "Other",
    order: 1,
  });
  const catalog = ["Alpha", "Other", "Beta", "Unassigned", "Gamma"].map(
    newParticipant,
  );
  initial.participantPlacements = catalog.map((p, index) =>
    newPlacement(
      p.id,
      index === 1 ? "other" : index === 3 ? "" : boundary.id,
      "current",
    ),
  );
  initial.participantPlacements[2].subtitle = "Keep placement details";
  let latest: Scenario = initial;
  const select = vi.fn();
  function Harness() {
    const [scenario, setScenario] = useState(initial);
    latest = scenario;
    return (
      <Participants
        scenario={scenario}
        catalog={catalog}
        onChange={setScenario}
        onCatalog={vi.fn()}
        onSelect={select}
      />
    );
  }
  render(<Harness />);
  const move = (name: string, direction: string) =>
    screen.getByRole("button", {
      name: `Move participant ${name} ${direction}`,
    });
  expect(move("Alpha", "up")).toBeDisabled();
  expect(move("Gamma", "down")).toBeDisabled();
  expect(move("Other", "up")).toBeDisabled();
  expect(move("Other", "down")).toBeDisabled();

  await user.click(move("Alpha", "down"));
  expect(latest.participantPlacements).toEqual([
    initial.participantPlacements[2],
    initial.participantPlacements[1],
    initial.participantPlacements[0],
    initial.participantPlacements[3],
    initial.participantPlacements[4],
  ]);
  expect(move("Beta", "up")).toBeDisabled();
  expect(select).not.toHaveBeenCalled();
  expect(
    screen
      .getAllByRole("button", { name: /Current only/ })
      .map((button) => button.textContent),
  ).toEqual([
    "BetaCurrent only",
    "AlphaCurrent only",
    "GammaCurrent only",
    "OtherCurrent only",
  ]);

  await user.click(move("Alpha", "up"));
  expect(latest.participantPlacements).toEqual(initial.participantPlacements);
  await user.click(screen.getByRole("button", { name: "Alpha Current only" }));
  expect(select).toHaveBeenCalledWith(catalog[0].id);
});

const handle = (name: string) =>
  screen.getByRole("button", { name: `Drag participant ${name} to reorder` });
const row = (name: string) =>
  handle(name).closest<HTMLElement>("[data-reorder-row]")!;
const card = (name: string) =>
  screen.getByDisplayValue(name).closest<HTMLElement>(".boundary-card")!;
const transfer = () => ({
  setData: vi.fn(),
  setDragImage: vi.fn(),
  dropEffect: "",
  effectAllowed: "",
});
function dragEvent(
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
function setupDrag() {
  const initial = newScenario();
  initial.boundaries = ["First", "Second", "Empty"].map((name, order) => ({
    ...initial.boundaries[0],
    id: name,
    name,
    order,
  }));
  const catalog = ["Alpha", "Beta", "Gamma", "Delta"].map(newParticipant);
  initial.participantPlacements = catalog.map((p, index) =>
    newPlacement(p.id, index < 3 ? "First" : "Second", "transition"),
  );
  initial.participantPlacements[0].subtitle = "Display subtitle";
  initial.participantPlacements[0].displayHints = { stretchToFill: true };
  initial.participantPlacements[0].badges = ["API"];
  initial.participantPlacements[0].target = false;
  const changed = vi.fn();
  const select = vi.fn();
  let latest = initial;
  function Harness() {
    const [scenario, setScenario] = useState(initial);
    latest = scenario;
    return (
      <Participants
        scenario={scenario}
        catalog={catalog}
        onChange={(next) => {
          changed(next);
          setScenario(next);
        }}
        onCatalog={vi.fn()}
        onSelect={select}
      />
    );
  }
  render(<Harness />);
  return { initial, catalog, changed, select, latest: () => latest };
}

it("drags participants down and up with insertion indicators and preserves other boundaries", () => {
  const { initial, changed, latest } = setupDrag();
  const data = transfer();
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("dragOver", row("Gamma"), data);
  expect(row("Gamma")).toHaveClass("drop-after");
  expect(card("First")).not.toHaveClass("drop-boundary");
  dragEvent("drop", row("Gamma"), data);
  expect(latest().participantPlacements).toEqual([
    initial.participantPlacements[1],
    initial.participantPlacements[2],
    initial.participantPlacements[0],
    initial.participantPlacements[3],
  ]);
  expect(changed).toHaveBeenCalledTimes(1); // The enclosing boundary must not also handle the drop.
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("dragOver", row("Beta"), data, -1);
  expect(row("Beta")).toHaveClass("drop-before");
  dragEvent("drop", row("Beta"), data, -1);
  expect(latest().participantPlacements).toEqual(initial.participantPlacements);
  expect(row("Alpha")).not.toHaveClass("dragging");
});

it("inserts between boundaries and moves single participants onto empty boundary cards", () => {
  const { initial, catalog, latest, select, changed } = setupDrag();
  const data = transfer();
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("drop", row("Delta"), data, -1);
  expect(latest().participantPlacements).toEqual([
    initial.participantPlacements[1],
    initial.participantPlacements[2],
    { ...initial.participantPlacements[0], boundaryId: "Second" },
    initial.participantPlacements[3],
  ]);
  expect(
    within(card("Second"))
      .getAllByRole("button", { name: /Drag participant/ })
      .map((b) => b.getAttribute("aria-label")),
  ).toEqual([
    "Drag participant Alpha to reorder",
    "Drag participant Delta to reorder",
  ]);
  expect(select).toHaveBeenLastCalledWith(catalog[0].id);
  expect(changed).toHaveBeenCalledTimes(1);
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("dragOver", card("Empty"), data);
  expect(card("Empty")).toHaveClass("drop-boundary");
  dragEvent("drop", card("Empty"), data);
  expect(latest().participantPlacements.at(-1)).toEqual({
    ...initial.participantPlacements[0],
    boundaryId: "Empty",
  });
  expect(handle("Alpha")).not.toBeDisabled();
  expect(card("Empty")).not.toHaveClass("drop-boundary");
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("drop", card("First"), data);
  expect(
    latest()
      .participantPlacements.filter((p) => p.boundaryId === "First")
      .map((p) => p.participantId),
  ).toEqual([catalog[1].id, catalog[2].id, catalog[0].id]);
  expect(latest().interactions).toEqual(initial.interactions);
});

it("ignores external, cancelled, and same-position drops", () => {
  const { changed, latest, initial } = setupDrag();
  const data = transfer();
  dragEvent("drop", card("Empty"), data);
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("drop", row("Beta"), data, -1);
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("drop", row("Alpha"), data);
  dragEvent("dragStart", handle("Alpha"), data);
  dragEvent("dragOver", card("Empty"), data);
  dragEvent("dragEnd", handle("Alpha"), data);
  dragEvent("drop", card("Empty"), data);
  expect(changed).not.toHaveBeenCalled();
  expect(latest()).toBe(initial);
  expect(card("Empty")).not.toHaveClass("drop-boundary");
});
