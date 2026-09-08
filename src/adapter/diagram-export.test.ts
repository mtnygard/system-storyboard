import { expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { seedWorkspace } from "../domain/seed";
import { newScenario } from "../domain/model";
import { exportDiagramArchive } from "./diagram-export";
it("packages every projection with both views and themes", () => {
  const w = seedWorkspace();
  const result = exportDiagramArchive(
    [{ scenario: w.scenarios[0], state: "target" }],
    w.participants,
  );
  expect(result.issues).toEqual([]);
  expect(result.diagramCount).toBe(12);
  const files = unzipSync(result.archive!);
  expect(Object.keys(files)).toHaveLength(25);
  for (const [name, value] of Object.entries(files)) {
    const content = strFromU8(value);
    if (name === "index.html") continue;
    expect(content).toContain("<svg");
    if (name.includes("/target/") && name.endsWith(".svg"))
      expect(content).not.toContain("Legacy ESB");
    if (name.endsWith(".html")) {
      expect(content).toContain(
        strFromU8(files[name.replace(/\.html$/, ".svg")]),
      );
      const doc = new DOMParser().parseFromString(content, "text/html");
      for (const link of doc.querySelectorAll("a")) {
        const destination = new URL(
          link.getAttribute("href")!,
          `https://export.test/${name}`,
        ).pathname.slice(1);
        expect(files[destination]).toBeDefined();
      }
    }
  }
  const index = new DOMParser().parseFromString(
    strFromU8(files["index.html"]),
    "text/html",
  );
  expect(index.querySelectorAll("a")).toHaveLength(24);
  for (const link of index.querySelectorAll("a"))
    expect(files[link.getAttribute("href")!]).toBeDefined();
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
  expect(result.diagramCount).toBe(16);
  const names = Object.keys(unzipSync(result.archive!));
  expect(names.filter((n) => n.startsWith("01-"))).toHaveLength(24);
  expect(
    names.filter((n) => n.startsWith("02-Order-to-SAP/current/")),
  ).toHaveLength(8);
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
  expect(result.diagramCount).toBe(12);
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
  expect(result.diagramCount).toBe(6);
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
