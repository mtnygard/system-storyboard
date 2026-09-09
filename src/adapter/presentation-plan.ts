import type { RenderedSvg } from "@coldtea/pr-lens-renderer";
import { compileScenario, renderPreview } from "./compiler";
import type { Participant, Scenario, State, Step } from "../domain/model";

export type PresentationView = "architecture" | "data-flow";
export type PresentationSlide = {
  heading: string;
  explanation: string;
  view: PresentationView;
  focus?: Step;
};
export type PresentationPlan = {
  title: string;
  state: State;
  theme: "light" | "dark";
  diagrams: Partial<Record<PresentationView, RenderedSvg>>;
  slides: PresentationSlide[];
};

/** Compile the requested state afresh; never export a held preview or silently
 * drop authored walkthrough cards. An incompatible card needs an author decision.
 */
export function planPresentation(
  scenario: Scenario,
  catalog: Participant[],
  state: State,
  theme: "light" | "dark",
): PresentationPlan {
  const compiled = compileScenario(scenario, catalog, state);
  if (!compiled.ok) throw Error(compiled.messages.join(" "));
  if (compiled.omitted.length)
    throw Error(
      "Complete the unfinished interactions before exporting PowerPoint.",
    );
  const diagrams: PresentationPlan["diagrams"] = {};
  for (const view of ["architecture", "data-flow"] as const) {
    const diagram = renderPreview(
      compiled.graph,
      view,
      theme,
      compiled.horizontalBoundaryIds,
      compiled.stretchParticipantIds,
    );
    if (diagram) diagrams[view] = diagram;
  }
  const nodes = new Set(compiled.graph.nodes.map((node) => node.id));
  const edges = new Set(compiled.graph.edges.map((edge) => edge.id));
  const slides: PresentationSlide[] = [
    {
      heading: scenario.name,
      explanation: "Architecture overview",
      view: "architecture",
    },
  ];
  for (const step of scenario.walkthroughSteps) {
    const view = step.stage === "architecture" ? "architecture" : "data-flow";
    if (!step.heading.trim() || !step.explanation.trim())
      throw Error(
        "Complete every walkthrough heading and explanation before exporting PowerPoint.",
      );
    if (
      !diagrams[view] ||
      step.participantIds.some((id) => !nodes.has(id)) ||
      step.interactionIds.some(
        (id) => !edges.has(`edge-${id}`) && !edges.has(`edge-${id}-target`),
      )
    )
      throw Error(
        `Walkthrough card “${step.heading}” refers to content unavailable in ${state}. Choose another presentation state or update the card.`,
      );
    slides.push({
      heading: step.heading,
      explanation: step.explanation,
      view,
      focus: step,
    });
  }
  // Scenarios without authored cards still include both available static views.
  if (!scenario.walkthroughSteps.length && diagrams["data-flow"])
    slides.push({
      heading: scenario.name,
      explanation: "Sequence overview",
      view: "data-flow",
    });
  return { title: scenario.name, state, theme, diagrams, slides };
}
