import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { STORAGE_KEY } from "../domain/storage";
import { compileScenario } from "../adapter/compiler";
import { WorkspaceSchema } from "../domain/model";
const preview = () =>
  screen.getByRole("region", { name: "Live diagram preview" });
it("edits a seeded scenario, keeps the last valid diagram, reorders, switches state and reloads persisted changes", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  expect(within(preview()).getByText("Preview up to date")).toBeInTheDocument();
  const before = preview().querySelector(".svg-render")!.innerHTML;
  await user.clear(screen.getByRole("textbox", { name: "Action for step 1" }));
  expect(
    within(preview()).getByText(/Showing the last valid/),
  ).toBeInTheDocument();
  expect(preview().querySelector(".svg-render")!.innerHTML).toBe(before);
  await user.type(
    screen.getByRole("textbox", { name: "Action for step 1" }),
    "Place customer order",
  );
  await waitFor(() =>
    expect(
      within(preview()).getByText("Preview up to date"),
    ).toBeInTheDocument(),
  );
  expect(preview().querySelector(".svg-render")!.innerHTML).toContain(
    "Place customer",
  );
  await user.click(
    screen.getByRole("button", { name: "Move interaction 1 down" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Action for step 2" }),
  ).toHaveValue("Place customer order");
  await user.click(within(preview()).getByRole("button", { name: "Sequence" }));
  expect(preview().querySelector(".svg-render")!.innerHTML).toContain(
    "Place customer",
  );
  await user.click(within(preview()).getByRole("button", { name: "Target" }));
  expect(
    within(preview()).queryByRole("button", { name: "Select Legacy ESB" }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).scenarios[0]
        .interactions[1].action,
    ).toBe("Place customer order"),
  );
  view.unmount();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  expect(
    screen.getByRole("textbox", { name: "Action for step 2" }),
  ).toHaveValue("Place customer order");
});
it("creates a scenario, participants and a five-step flow entirely through the interface", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Create scenario" }));
  await user.type(
    screen.getByRole("textbox", { name: "Scenario name" }),
    "Invoice settlement",
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Create scenario",
    }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Business trigger" }),
    "An invoice is approved.",
  );
  await user.click(screen.getByRole("button", { name: "Choose participants" }));
  for (const name of ["Finance", "Ledger"]) {
    await user.type(
      screen.getByRole("textbox", { name: "Create a participant" }),
      name,
    );
    await user.click(screen.getByRole("button", { name: "Create & add" }));
  }
  await user.click(screen.getByRole("button", { name: /Interactions/ }));
  for (let n = 1; n <= 5; n++) {
    await user.click(screen.getByRole("button", { name: "Add interaction" }));
    const from = screen.getByRole("combobox", { name: `From for step ${n}` });
    const to = screen.getByRole("combobox", { name: `To for step ${n}` });
    const fromId = within(from)
      .getByRole("option", { name: n % 2 ? "Finance" : "Ledger" })
      .getAttribute("value")!;
    const toId = within(to)
      .getByRole("option", { name: n % 2 ? "Ledger" : "Finance" })
      .getAttribute("value")!;
    await user.selectOptions(from, fromId);
    await user.selectOptions(to, toId);
    await user.type(
      screen.getByRole("textbox", { name: `Action for step ${n}` }),
      `Settle invoice ${n}`,
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Interaction pattern" }),
      "synchronous request",
    );
  }
  expect(within(preview()).getByText("Preview up to date")).toBeInTheDocument();
  await user.click(within(preview()).getByRole("button", { name: "Sequence" }));
  expect(preview().querySelector("svg")).toBeInTheDocument();
  await waitFor(() => {
    const w = WorkspaceSchema.parse(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!),
    );
    const s = w.scenarios.find((s) => s.name === "Invoice settlement")!;
    expect(s.interactions).toHaveLength(5);
    expect(compileScenario(s, w.participants, "current").ok).toBe(true);
  });
  await user.click(screen.getByRole("button", { name: /Walkthrough/ }));
  await user.click(screen.getByRole("button", { name: "Generate cards" }));
  expect(screen.getAllByRole("textbox", { name: "Heading" })).toHaveLength(6);
  await user.click(
    screen.getByRole("button", { name: "Show walkthrough step 2" }),
  );
  expect(
    preview().querySelectorAll(".atlas-target.focused").length,
  ).toBeGreaterThan(0);
});
it("starts static for reduced-motion users", async () => {
  const original = window.matchMedia;
  window.matchMedia = vi
    .fn()
    .mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Order to SAP/ }));
  expect(
    screen.getByRole("button", { name: "Play traffic" }),
  ).toBeInTheDocument();
  window.matchMedia = original;
});

it("offers scope-aware bulk export from the workspace and scenario, keeping the scenario file after diagrams", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Export all diagrams" }));
  expect(
    screen.getByRole("heading", { name: "Export workspace diagrams" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/all 1 scenarios/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  await user.click(screen.getByRole("button", { name: "Export" }));
  const dialog = within(screen.getByRole("dialog"));
  const bulk = dialog.getByRole("button", { name: /Export all diagrams/ });
  const editable = dialog.getByRole("button", { name: /Studio scenario/ });
  expect(
    bulk.compareDocumentPosition(editable) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(dialog.queryByText("PR Lens graph document")).not.toBeInTheDocument();
});

it("confirms clearing the workspace and preserves the empty workspace after reload", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Clear workspace" }));
  await user.click(screen.getByRole("button", { name: "Keep workspace" }));
  expect(
    screen.getByRole("button", { name: /Order to SAP/ }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear workspace" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Clear workspace",
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Your workspace is empty" }),
  ).toBeInTheDocument();
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.scenarios).toEqual([]);
    expect(saved.participants).toEqual([]);
  });
  view.unmount();
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Your workspace is empty" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Create scenario" }));
  await user.type(
    screen.getByRole("textbox", { name: "Scenario name" }),
    "Fresh start",
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Create scenario",
    }),
  );
  expect(screen.getByRole("textbox", { name: "Scenario name" })).toHaveValue(
    "Fresh start",
  );
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.scenarios).toHaveLength(1);
    expect(saved.participants).toEqual([]);
  });
});

it("captures a pasted story immediately, then completes one step and moves to the next", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  const capture = screen.getByRole("textbox", { name: "Actions to capture" });
  fireEvent.change(capture, {
    target: { value: "Reserve inventory\nNotify warehouse\nSchedule delivery" },
  });
  await user.click(capture);
  await user.keyboard("{Enter}");
  expect(capture).toHaveValue("");
  expect(capture).toHaveFocus();
  expect(
    screen.getByRole("textbox", { name: "Action for step 9" }),
  ).toHaveValue("Reserve inventory");
  expect(within(preview()).getByText(/3 unfinished steps/)).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Complete details (3)" }),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Interaction sender" }),
    "p-store",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Interaction receiver" }),
    "p-sap",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Interaction pattern" }),
    "synchronous request",
  );
  expect(within(preview()).getByText(/2 unfinished steps/)).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Next unfinished step" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Interaction action" }),
  ).toHaveValue("Notify warehouse");
  await waitFor(() => {
    const w = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(w.scenarios[0].interactions[9].pattern).toBe("not specified");
    expect(w.scenarios[0].interactions[8].pattern).toBe("synchronous request");
  });
});
it("composes a step with an inline-created participant and creates an editable reply", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  await user.click(
    screen.getByRole("button", { name: "Add participants now" }),
  );
  await user.type(
    screen.getByRole("combobox", { name: "Capture sender" }),
    "Order Portal",
  );
  await user.type(
    screen.getByRole("combobox", { name: "Capture receiver" }),
    "Warehouse",
  );
  await user.click(screen.getByRole("button", { name: "Create “Warehouse”" }));
  await user.type(
    screen.getByRole("textbox", { name: "Actions to capture" }),
    "Request stock",
  );
  await user.click(screen.getByRole("button", { name: "Capture steps" }));
  await user.click(
    screen.getByRole("button", { name: "Complete details (1)" }),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Interaction pattern" }),
    "synchronous request",
  );
  await user.click(screen.getByRole("button", { name: "Receiver replies" }));
  expect(
    screen.getByRole("combobox", { name: "Interaction pattern" }),
  ).toHaveValue("return");
  expect(
    screen.getByRole("combobox", { name: "Interaction receiver" }),
  ).toHaveValue("p-store");
  expect(
    screen.getByRole("textbox", { name: "Interaction action" }),
  ).toHaveValue("");
  await user.type(
    screen.getByRole("textbox", { name: "Interaction action" }),
    "Return availability",
  );
  expect(within(preview()).getByText("Preview up to date")).toBeInTheDocument();
});
