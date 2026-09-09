import { useState } from "react";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
