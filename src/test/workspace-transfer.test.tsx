import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { seedWorkspace } from "../domain/seed";
import { newParticipant, newScenario } from "../domain/model";
import {
  download,
  importWorkspace,
  workspaceExport,
  STORAGE_KEY,
} from "../domain/storage";

vi.mock("../domain/storage", async (original) => ({
  ...(await original<typeof import("../domain/storage")>()),
  download: vi.fn(),
}));

it("exports every scenario and shared or unused catalog participant in one restorable file", async () => {
  const workspace = seedWorkspace();
  workspace.scenarios.push({
    ...workspace.scenarios[0],
    id: "second",
    name: "Second scenario",
  });
  workspace.scenarios.push(newScenario("Unfinished draft"));
  workspace.participants.push(newParticipant("Unused participant"));
  workspace.scenarios[0].participantPlacements[0].displayHints = {
    stretchToFill: false,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  render(<App />);
  await userEvent.click(
    screen.getByRole("button", { name: "Export workspace" }),
  );
  const [filename, raw] = vi.mocked(download).mock.calls.at(-1)!;
  expect(filename).toMatch(/\.workspace\.studio\.json$/);
  expect(importWorkspace(raw as string)).toEqual(workspace);
});

it("reviews, cancels, then replaces and persists a complete workspace", async () => {
  const user = userEvent.setup();
  const incoming = seedWorkspace();
  incoming.name = "Restored workspace";
  incoming.scenarios = [newScenario("Restored scenario")];
  incoming.participants.push(newParticipant("Unused restored participant"));
  const view = render(<App />);
  const input = screen.getByLabelText("Import Studio workspace file");
  const file = new File([], "backup.json", { type: "application/json" });
  file.text = async () => JSON.stringify(workspaceExport(incoming));
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole("dialog")).toHaveTextContent(
    "Restored workspace",
  );
  expect(
    screen.getByRole("button", { name: /Order to SAP/ }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole("dialog");
  await user.click(screen.getByRole("button", { name: "Replace workspace" }));
  expect(
    screen.queryByRole("button", { name: /Order to SAP/ }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(incoming),
  );
  view.unmount();
  render(<App />);
  expect(
    screen.getByRole("button", { name: /Restored scenario/ }),
  ).toBeInTheDocument();
});

it("leaves the current workspace intact when an import is invalid", async () => {
  render(<App />);
  const file = new File([], "invalid.json");
  file.text = async () => '{"version":99}';
  fireEvent.change(screen.getByLabelText("Import Studio workspace file"), {
    target: { files: [file] },
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "not a supported Studio workspace",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Order to SAP/ }),
  ).toBeInTheDocument();
});

it("rejects malformed, unsupported and duplicate-identity workspace backups", () => {
  const doc = workspaceExport(seedWorkspace());
  for (const value of [
    "broken",
    JSON.stringify({ ...doc, version: 2 }),
    JSON.stringify({ ...doc, workspace: { ...doc.workspace, version: 2 } }),
  ]) {
    expect(() => importWorkspace(value)).toThrow(
      "not a supported Studio workspace",
    );
  }
  doc.workspace.scenarios.push(doc.workspace.scenarios[0]);
  expect(() => importWorkspace(JSON.stringify(doc))).toThrow(
    "not a supported Studio workspace",
  );
});

it("round trips an empty workspace", () => {
  const workspace = { ...seedWorkspace(), scenarios: [], participants: [] };
  expect(importWorkspace(JSON.stringify(workspaceExport(workspace)))).toEqual(
    workspace,
  );
});
