import { useState } from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickCapture } from "./QuickCapture";
import { newParticipant, newScenario, type Scenario } from "../domain/model";

it("previews and captures different endpoints per line using only the keyboard", async () => {
  const user = userEvent.setup();
  const catalog = [
    "Customer Portal",
    "Order Processing Service",
    "Inventory Service",
  ].map(newParticipant);
  let latest = newScenario();
  function Harness() {
    const [scenario, setScenario] = useState(latest);
    latest = scenario;
    return (
      <QuickCapture
        scenario={scenario}
        captureState="target"
        catalog={catalog}
        onChange={setScenario}
        onCatalog={vi.fn()}
      />
    );
  }
  render(<Harness />);
  await user.tab(); // optional participant controls
  await user.tab(); // capture field
  const input = screen.getByRole("textbox", { name: "Actions to capture" });
  expect(input).toHaveFocus();
  await user.keyboard(
    '"Customer Portal" calls "Order Processing Service"{Shift>}{Enter}{/Shift}Order Processing Service queries Inventory Service{Shift>}{Enter}{/Shift}Check inventory',
  );
  const preview = within(
    screen.getByRole("region", { name: "Capture preview" }),
  );
  expect(preview.getByText("From: Customer Portal")).toBeInTheDocument();
  expect(preview.getByText("To: Order Processing Service")).toBeInTheDocument();
  expect(preview.getByText("Action: calls")).toBeInTheDocument();
  expect(preview.getByText(/Action only/)).toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
  expect(latest.interactions).toMatchObject([
    {
      fromParticipantId: catalog[0].id,
      action: "calls",
      toParticipantId: catalog[1].id,
      current: false,
      target: true,
      pattern: "not specified",
    },
    {
      fromParticipantId: catalog[1].id,
      action: "queries",
      toParticipantId: catalog[2].id,
    },
    { fromParticipantId: "", action: "Check inventory", toParticipantId: "" },
  ]);
  expect(latest.participantPlacements.map((p) => p.participantId)).toEqual(
    catalog.map((p) => p.id),
  );
});

it("validates the parsed action length rather than the whole sentence", async () => {
  const user = userEvent.setup();
  const catalog = [
    newParticipant("A".repeat(100)),
    newParticipant("B".repeat(100)),
  ];
  const change = vi.fn();
  render(
    <QuickCapture
      scenario={newScenario()}
      catalog={catalog}
      onChange={change}
      onCatalog={vi.fn()}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Actions to capture" });
  fireEvent.change(input, {
    target: { value: `${catalog[0].name} calls ${catalog[1].name}` },
  });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change.mock.calls[0][0].interactions[0].action).toBe("calls");
  fireEvent.change(input, {
    target: {
      value: `${catalog[0].name} ${"x".repeat(121)} ${catalog[1].name}`,
    },
  });
  await user.click(input);
  await user.keyboard("{Enter}");
  expect(change).toHaveBeenCalledTimes(1);
  expect(input).not.toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("120 characters");
});

it("preserves ambiguous input without capturing any of the batch", () => {
  const catalog = ["Customer", "API", "API"].map(newParticipant);
  const change = vi.fn<(s: Scenario) => void>();
  render(
    <QuickCapture
      scenario={newScenario()}
      catalog={catalog}
      onChange={change}
      onCatalog={vi.fn()}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Actions to capture" });
  fireEvent.change(input, {
    target: { value: "Check inventory\nCustomer calls API" },
  });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveValue("Check inventory\nCustomer calls API");
  expect(screen.getByRole("status")).toHaveTextContent(
    "More than one participant",
  );
});

it("allows optional participant selections to override parsed endpoints", async () => {
  const user = userEvent.setup();
  const catalog = ["Customer", "API", "Override"].map(newParticipant);
  const change = vi.fn();
  render(
    <QuickCapture
      scenario={newScenario()}
      catalog={catalog}
      onChange={change}
      onCatalog={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Add participants now" }),
  );
  await user.type(
    screen.getByRole("combobox", { name: "Capture sender" }),
    "Override",
  );
  const input = screen.getByRole("textbox", { name: "Actions to capture" });
  await user.type(input, "Customer calls API");
  expect(
    within(screen.getByRole("region", { name: "Capture preview" })).getByText(
      "From: Override",
    ),
  ).toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(change.mock.calls[0][0].interactions[0]).toMatchObject({
    fromParticipantId: catalog[2].id,
    toParticipantId: catalog[1].id,
    action: "calls",
  });
});
