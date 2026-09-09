import {
  diagramHtml,
  diagramIndex,
  type DiagramPageLink,
  type DiagramVariant,
} from "./diagram-html";
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

/** Match the workbench: transition stories have three projections. */
export function scenarioDiagramVariants(
  scenario: Scenario,
  catalog: Participant[],
  theme?: "light" | "dark",
): DiagramVariant[] {
  if (!theme)
    return (["light", "dark"] as const).flatMap((value) =>
      scenarioDiagramVariants(scenario, catalog, value),
    );
  const states: State[] =
    scenario.mode === "transition"
      ? ["current", "target", "transition"]
      : [scenario.mode];
  return states.flatMap((state) => {
    const compiled = compileScenario(scenario, catalog, state);
    return (["architecture", "data-flow"] as const).map((lens) => {
      const view = lens === "architecture" ? "Architecture" : "Sequence";
      const notes: string[] = [];
      const variant: DiagramVariant = { state, view, theme, notes };
      if (!compiled.ok) {
        notes.push(
          `${scenario.name} (${state}): ${compiled.messages.join(" ")}`,
        );
        return variant;
      }
      if (compiled.omitted.length)
        notes.push(
          `${scenario.name} (${state}): Unfinished steps ${compiled.omitted.map((i) => i.position).join(", ")} are omitted from these diagrams. Complete their details to export the full story.`,
        );
      try {
        const rendered = renderPreview(
          compiled.graph,
          lens,
          theme,
          compiled.horizontalBoundaryIds,
          compiled.stretchParticipantIds,
        );
        if (!rendered) throw Error("Unavailable diagram");
        variant.svg = rendered.svg;
      } catch {
        notes.push(
          `${scenario.name} (${state}): The ${view.toLowerCase()} diagram is unavailable. Review the architecture checks and include at least two participants and one complete interaction.`,
        );
      }
      return variant;
    });
  });
}

/** Freshly compile every projection: a held preview must never enter an archive. */
export function exportDiagramArchive(
  targets: DiagramExportTarget[],
  catalog: Participant[],
): DiagramExportResult {
  const files: Record<string, Uint8Array> = {};
  const issues = new Set<string>();
  const entries: DiagramPageLink[] = [];
  let diagramCount = 0;
  targets.forEach(({ scenario }, index) => {
    const folder = `${String(index + 1).padStart(2, "0")}-${filename(scenario.name)}`;
    const variants = scenarioDiagramVariants(scenario, catalog).map((v) => ({
      ...v,
      svgFilename: `../${v.state}/${v.view.toLowerCase()}-${v.theme}.svg`,
    }));
    for (const variant of variants) {
      variant.notes.forEach((note) => issues.add(note));
      if (!variant.svg) continue;
      const { state, view, theme, svg } = variant;
      const path = `${folder}/${state}/${view.toLowerCase()}-${theme}`;
      files[`${path}.svg`] = strToU8(svg);
      files[`${path}.html`] = strToU8(
        diagramHtml({
          title: scenario.name,
          state,
          view,
          theme,
          svg,
          variants,
          indexHref: "../../index.html",
        }),
      );
      entries.push({ title: scenario.name, state, view, theme, path });
      diagramCount++;
    }
  });
  const notes = [...issues];
  if (!diagramCount)
    return {
      diagramCount,
      issues: notes.length ? notes : ["There are no scenarios to export."],
    };
  files["index.html"] = strToU8(diagramIndex(entries, notes));
  if (notes.length)
    files["EXPORT-NOTES.txt"] = strToU8(
      "Export notes:\n\n" + notes.join("\n\n"),
    );
  return { archive: zipSync(files), diagramCount, issues: notes };
}
