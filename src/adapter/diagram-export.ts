import { strToU8, zipSync } from "fflate";
import type { Participant, Scenario, State } from "../domain/model";
import { compileScenario, renderPreview } from "./compiler";

export type DiagramExportTarget = { scenario: Scenario; state: State };
export type DiagramExportResult = {
  archive?: Uint8Array;
  diagramCount: number;
  issues: string[];
};
const filename = (name: string) =>
  name
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "scenario";

/** Freshly compile every target: a held preview must never enter an archive. */
export function exportDiagramArchive(
  targets: DiagramExportTarget[],
  catalog: Participant[],
): DiagramExportResult {
  const files: Record<string, Uint8Array> = {};
  const issues: string[] = [];
  let diagramCount = 0;
  targets.forEach(({ scenario, state }, index) => {
    const folder = `${String(index + 1).padStart(2, "0")}-${filename(scenario.name)}/${state}`;
    const compiled = compileScenario(scenario, catalog, state);
    if (!compiled.ok) {
      issues.push(
        `${scenario.name || "Untitled scenario"}: No diagrams exported. ${compiled.messages.join(" ")}`,
      );
      return;
    }
    if (compiled.omitted.length)
      issues.push(
        `${scenario.name}: Unfinished steps ${compiled.omitted.map((i) => i.position).join(", ")} are omitted from these diagrams. Complete their details to export the full story.`,
      );
    for (const lens of ["architecture", "data-flow"] as const) {
      const label = lens === "architecture" ? "architecture" : "sequence";
      if (!compiled.graph.lenses.includes(lens)) {
        issues.push(
          `${scenario.name}: The ${label} diagram is unavailable. Include at least two participants and one complete interaction.`,
        );
        continue;
      }
      for (const theme of ["light", "dark"] as const) {
        try {
          const rendered = renderPreview(compiled.graph, lens, theme);
          if (!rendered) throw Error("Unavailable diagram");
          files[`${folder}/${label}-${theme}.svg`] = strToU8(rendered.svg);
          diagramCount++;
        } catch {
          issues.push(
            `${scenario.name}: The ${theme} ${label} diagram could not be drawn. Review this scenario’s architecture checks.`,
          );
        }
      }
    }
  });
  if (!diagramCount)
    return {
      diagramCount,
      issues: issues.length ? issues : ["There are no scenarios to export."],
    };
  if (issues.length)
    files["EXPORT-NOTES.txt"] = strToU8(
      "Some diagrams could not be exported:\n\n" + issues.join("\n\n"),
    );
  return { archive: zipSync(files), diagramCount, issues };
}
