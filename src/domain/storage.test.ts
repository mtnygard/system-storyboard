import { describe, it, expect } from "vitest";
import { seedWorkspace } from "./seed";
import {
  importScenario,
  scenarioExport,
  saveWorkspace,
  loadWorkspace,
  STORAGE_KEY,
  parseCsv,
  importCsv,
  validateWorkspace,
} from "./storage";
import { architectureChecks } from "./checks";
import { compileScenario } from "../adapter/compiler";
describe("workspace persistence and imports", () => {
  it("round trips all enterprise metadata through an isolated scenario copy", () => {
    const w = seedWorkspace();
    const output = JSON.stringify(
      scenarioExport(w.scenarios[0], w.participants),
    );
    const next = importScenario(output, w);
    expect(next.scenarios).toHaveLength(2);
    expect(next.scenarios[1].id).not.toBe(w.scenarios[0].id);
    expect(next.scenarios[1].interactions).toHaveLength(8);
    expect(next.scenarios[1].interactions[5].resilience).toContain(
      "idempotency",
    );
    expect(next.scenarios[1].participantPlacements[0].participantId).not.toBe(
      w.participants[0].id,
    );
    expect(
      compileScenario(next.scenarios[1], next.participants, "transition").ok,
    ).toBe(true);
  });
  it("persists drafts and reloads the saved workspace", () => {
    const w = seedWorkspace();
    w.scenarios[0].interactions[0].action = "";
    expect(saveWorkspace(w)).toBe(true);
    expect(loadWorkspace().workspace.scenarios[0].interactions[0].action).toBe(
      "",
    );
  });
  it("protects unreadable stored data", () => {
    localStorage.setItem(STORAGE_KEY, "broken");
    expect(loadWorkspace().error).toContain("not been overwritten");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("broken");
  });
  it("rejects unsupported versions and duplicate identities", () => {
    const w = seedWorkspace();
    expect(() => validateWorkspace({ ...w, version: 2 })).toThrow();
    expect(() =>
      validateWorkspace({
        ...w,
        participants: [...w.participants, w.participants[0]],
      }),
    ).toThrow();
    expect(() => importScenario('{"format":"unknown"}', w)).toThrow(
      "not a supported",
    );
  });
  it("handles quoted CSV commas, newlines and escaped quotes", () =>
    expect(
      parseCsv('From,Action,To\r\nA,"Send, then ""wait""\nagain",B'),
    ).toEqual([
      ["From", "Action", "To"],
      ["A", 'Send, then "wait"\nagain', "B"],
    ]));
  it("imports known catalog participants and returns a valid preview", () => {
    const w = seedWorkspace();
    const s = { ...w.scenarios[0], interactions: [], walkthroughSteps: [] };
    const next = importCsv(
      "From,Action,To,Pattern,Technology\nCustomer,Submit,Order Portal,synchronous request,HTTPS",
      s,
      w.participants,
    );
    expect(next.interactions).toHaveLength(1);
    expect(compileScenario(next, w.participants, "transition").ok).toBe(true);
  });
  it("reports CSV problems without modifying the source", () => {
    const w = seedWorkspace();
    const before = JSON.stringify(w);
    expect(() =>
      importCsv(
        "From,Action,To\nUnknown,Send,Customer",
        w.scenarios[0],
        w.participants,
      ),
    ).toThrow("must match one catalog participant");
    expect(JSON.stringify(w)).toBe(before);
  });
  it("detects operational, state, boundary, duplicate-name and completeness problems", () => {
    const w = seedWorkspace();
    const s = w.scenarios[0];
    s.trigger = "";
    s.participantPlacements[0].boundaryId = "";
    s.participantPlacements[1].target = false;
    s.interactions[0].resilience = "";
    s.interactions = s.interactions.filter((i) => i.id !== "i-confirm");
    w.participants[1].name = "Customer";
    s.boundaries[1].dimension = "platform";
    const messages = architectureChecks(s, w.participants)
      .map((c) => c.message)
      .join("\n");
    expect(messages).toContain("business trigger");
    expect(messages).toContain("outside every boundary");
    expect(messages).toContain("where it is not included");
    expect(messages).toContain("More than one");
    expect(messages).toContain("mix classification");
    expect(messages).toContain("no return, timeout");
  });
});
