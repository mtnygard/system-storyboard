import { expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { seedWorkspace } from "../domain/seed";
import { newScenario } from "../domain/model";
import { exportDiagramArchive } from "./diagram-export";
it("packages both views and themes for the selected scenario state", () => {
  const w = seedWorkspace();
  const result = exportDiagramArchive(
    [{ scenario: w.scenarios[0], state: "target" }],
    w.participants,
  );
  expect(result.issues).toEqual([]);
  expect(result.diagramCount).toBe(4);
  const files = unzipSync(result.archive!);
  expect(Object.keys(files)).toEqual([
    "01-Order-to-SAP/target/architecture-light.svg",
    "01-Order-to-SAP/target/architecture-dark.svg",
    "01-Order-to-SAP/target/sequence-light.svg",
    "01-Order-to-SAP/target/sequence-dark.svg",
  ]);
  for (const value of Object.values(files)) {
    expect(strFromU8(value)).toContain("<svg");
    expect(strFromU8(value)).not.toContain("Legacy ESB");
  }
  expect(
    strFromU8(files["01-Order-to-SAP/target/architecture-light.svg"]),
  ).toContain("data-studio-slot");
});
it("exports all workspace scenarios with collision-safe folders and their own modes", () => {
  const w = seedWorkspace();
  const second = structuredClone(w.scenarios[0]);
  second.id = "another";
  second.mode = "current";
  const result = exportDiagramArchive(
    [w.scenarios[0], second].map((scenario) => ({
      scenario,
      state: scenario.mode,
    })),
    w.participants,
  );
  expect(result.diagramCount).toBe(8);
  const names = Object.keys(unzipSync(result.archive!));
  expect(names.filter((n) => n.startsWith("01-"))).toHaveLength(4);
  expect(
    names.filter((n) => n.startsWith("02-Order-to-SAP/current/")),
  ).toHaveLength(4);
});
it("reports invalid scenarios without exporting stale diagrams or losing valid scenarios", () => {
  const w = seedWorkspace();
  const invalid = newScenario("Unfinished");
  const result = exportDiagramArchive(
    [
      { scenario: w.scenarios[0], state: "transition" },
      { scenario: invalid, state: "current" },
    ],
    w.participants,
  );
  expect(result.diagramCount).toBe(4);
  expect(result.issues.join()).toContain("Unfinished");
  const files = unzipSync(result.archive!);
  expect(strFromU8(files["EXPORT-NOTES.txt"])).toContain("Unfinished");
  expect(Object.keys(files).some((n) => n.startsWith("02-"))).toBe(false);
});
it("exports an available architecture and explains an unavailable sequence", () => {
  const w = seedWorkspace();
  const s = w.scenarios[0];
  s.interactions = [];
  s.walkthroughSteps = [];
  const result = exportDiagramArchive(
    [{ scenario: s, state: "transition" }],
    w.participants,
  );
  expect(result.diagramCount).toBe(2);
  expect(result.issues.join()).toContain("sequence diagram is unavailable");
});
it("does not produce a misleading empty ZIP when nothing can be exported", () => {
  expect(exportDiagramArchive([], []).archive).toBeUndefined();
  const result = exportDiagramArchive(
    [{ scenario: newScenario(), state: "current" }],
    [],
  );
  expect(result.archive).toBeUndefined();
  expect(result.diagramCount).toBe(0);
  expect(result.issues.length).toBeGreaterThan(0);
});
