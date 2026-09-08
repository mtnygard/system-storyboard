import { expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import App from "../App";
import { InteractionTable } from "../components/InteractionTable";
import { seedWorkspace } from "../domain/seed";
beforeEach(() => localStorage.clear());
it("keeps diagram state independent while capturing target interactions", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  const diagram = screen.getByLabelText("Presentation state");
  await user.click(within(diagram).getByRole("button", { name: "Current" }));
  await user.click(
    within(screen.getByRole("group", { name: "Editing state" })).getByRole(
      "button",
      { name: "Target" },
    ),
  );
  expect(
    within(diagram).getByRole("button", { name: "Current" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByDisplayValue("Forward order")).not.toBeInTheDocument();
  await user.type(
    screen.getByLabelText("Actions to capture"),
    "New target step{Enter}",
  );
  expect(screen.getByDisplayValue("New target step")).toBeInTheDocument();
  await user.click(
    within(screen.getByRole("group", { name: "Editing state" })).getByRole(
      "button",
      { name: "Current" },
    ),
  );
  expect(screen.queryByDisplayValue("New target step")).not.toBeInTheDocument();
});
it("initializes once and lets target edits diverge from shared steps", async () => {
  const w = seedWorkspace();
  const original = w.scenarios[0];
  original.interactions = original.interactions
    .filter((i) => i.current)
    .map((i) => ({ ...i, target: false }));
  function Harness() {
    const [s, setS] = useState(original);
    return (
      <InteractionTable
        scenario={s}
        catalog={w.participants}
        onSelect={() => {}}
        onChange={setS}
        onCatalog={() => {}}
      />
    );
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole("button", { name: "Populate target from current" }),
  );
  expect(
    screen.getByRole("button", { name: "Populate target from current" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: /Vary target/ }),
  ).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText("Action for step 1"));
  await user.type(
    screen.getByLabelText("Action for step 1"),
    "Target variation",
  );
  await user.click(
    within(screen.getByRole("group", { name: "Editing state" })).getByRole(
      "button",
      { name: "Current" },
    ),
  );
  expect(screen.getByLabelText("Action for step 1")).toHaveValue(
    "Submit order",
  );
  expect(
    screen.queryByDisplayValue("Target variation"),
  ).not.toBeInTheDocument();
});

it("resets a field override through its compact icon", async () => {
  const w = seedWorkspace();
  function Harness() {
    const [s, setS] = useState(w.scenarios[0]);
    return (
      <InteractionTable
        scenario={s}
        catalog={w.participants}
        onSelect={() => {}}
        onChange={setS}
        onCatalog={() => {}}
      />
    );
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    within(screen.getByRole("group", { name: "Editing state" })).getByRole(
      "button",
      { name: "Target" },
    ),
  );
  await user.clear(screen.getByLabelText("Action for step 1"));
  await user.type(
    screen.getByLabelText("Action for step 1"),
    "Overridden action",
  );
  await user.click(
    screen.getByRole("button", {
      name: "Reset action to current: Submit order",
    }),
  );
  expect(screen.getByLabelText("Action for step 1")).toHaveValue(
    "Submit order",
  );
  expect(
    screen.getByRole("button", {
      name: "action uses current value: Submit order",
    }),
  ).toHaveAttribute("aria-disabled", "true");
});

it("explains completed fields and focuses missing details on established interactions", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  expect(
    screen.queryByRole("button", { name: /Complete details/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Required fields complete")).toBeInTheDocument();
  await user.clear(screen.getByLabelText("Action for step 1"));
  await user.click(screen.getByRole("button", { name: "Close inspector" }));
  await user.click(
    screen.getByRole("button", { name: "Complete details (1)" }),
  );
  await screen.findByLabelText("Interaction action");
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(screen.getByLabelText("Interaction action")).toHaveFocus();
});
