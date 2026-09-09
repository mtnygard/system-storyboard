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
import { compileScenario, renderPreview } from "../adapter/compiler";
import type { Scenario, Participant } from "./model";
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
  it.each(["empty", "existing"] as const)(
    "round trips visual properties and diagram geometry into an %s workspace",
    (destination) => {
      const source = seedWorkspace();
      const scenario = source.scenarios[0];
      scenario.boundaries.forEach((boundary, index) => {
        boundary.orientation = index === 1 ? "horizontal" : "vertical";
      });
      scenario.participantPlacements.forEach((placement, index) => {
        placement.displayHints = { stretchToFill: index % 2 === 0 };
        placement.subtitle = `Display subtitle ${index + 1}`;
        placement.badges = [`Badge ${index + 1}`];
      });
      // The saved order, rather than catalog or creation order, drives the layout.
      [scenario.participantPlacements[0], scenario.participantPlacements[1]] = [
        scenario.participantPlacements[1],
        scenario.participantPlacements[0],
      ];
      const before = JSON.stringify(source);
      const file = JSON.stringify(
        scenarioExport(scenario, source.participants),
      );
      const serialized = JSON.parse(file);
      expect(serialized.scenario.boundaries[1].orientation).toBe("horizontal");
      expect(
        serialized.scenario.participantPlacements.map(
          (p: (typeof scenario.participantPlacements)[number]) =>
            p.displayHints?.stretchToFill,
        ),
      ).toEqual([false, true, true, false, true, false]);

      const target =
        destination === "empty"
          ? { ...source, scenarios: [], participants: [] }
          : source;
      const imported = importScenario(file, target);
      const copy = imported.scenarios.at(-1)!;
      const originalIds = scenario.participantPlacements.map(
        (p) => p.participantId,
      );
      const copiedIds = copy.participantPlacements.map((p) => p.participantId);
      expect(copiedIds.every((id) => !originalIds.includes(id))).toBe(true);
      expect(copy.boundaries).toEqual(scenario.boundaries);
      expect(
        copy.participantPlacements.map((p, index) => ({
          ...p,
          participantId: originalIds[index],
        })),
      ).toEqual(scenario.participantPlacements);
      expect(
        copiedIds.map(
          (id) => imported.participants.find((p) => p.id === id)?.name,
        ),
      ).toEqual(
        originalIds.map(
          (id) => source.participants.find((p) => p.id === id)?.name,
        ),
      );

      for (const state of ["current", "target", "transition"] as const) {
        const compile = (s: Scenario, catalog: Participant[]) => {
          const result = compileScenario(s, catalog, state);
          if (!result.ok) throw Error(result.messages.join());
          return result;
        };
        const a = compile(scenario, source.participants);
        const b = compile(copy, imported.participants);
        for (const theme of ["light", "dark"] as const) {
          for (const lens of ["architecture", "data-flow"] as const) {
            const original = renderPreview(
              a.graph,
              lens,
              theme,
              a.horizontalBoundaryIds,
              a.stretchParticipantIds,
            )!;
            const restored = renderPreview(
              b.graph,
              lens,
              theme,
              b.horizontalBoundaryIds,
              b.stretchParticipantIds,
            )!;
            expect(restored.width).toBe(original.width);
            expect(restored.height).toBe(original.height);
            expect(restored.atlas.lanes).toEqual(original.atlas.lanes);
            expect(restored.atlas.edges).toEqual(original.atlas.edges);
            expect(copiedIds.map((id) => restored.atlas.nodes[id])).toEqual(
              originalIds.map((id) => original.atlas.nodes[id]),
            );
            expect(restored.svg).toBe(original.svg);
          }
        }
      }
      // Import and a second export retain every display property, including false.
      const secondFile = JSON.stringify(
        scenarioExport(copy, imported.participants),
      );
      const secondCopy = importScenario(secondFile, target).scenarios.at(-1)!;
      expect(secondCopy.boundaries).toEqual(scenario.boundaries);
      expect(
        secondCopy.participantPlacements.map((p) => p.displayHints),
      ).toEqual(scenario.participantPlacements.map((p) => p.displayHints));
      expect(JSON.stringify(source)).toBe(before);
    },
  );
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
