import { projectInteractions } from "../domain/interaction-overrides";
import { isPendingDraft } from "../domain/drafts";
import { sequenceParticipantOrder } from "../domain/sequence-order";
import { renderPlatforms } from "./platform-renderer";
import { sequenceArchitectureTraffic } from "./architecture-timing";
import {
  safeParseGraphDoc,
  SCHEMA_VERSION,
  type GraphDoc,
  type GraphDocInput,
  type NodeKind,
  type EdgeKind,
  type MessageKind,
} from "@coldtea/pr-lens-schema";
import { render, type RenderedSvg } from "@coldtea/pr-lens-renderer";
import type {
  Scenario,
  Participant,
  State,
  Interaction,
} from "../domain/model";
import { architectureChecks, included } from "../domain/checks";
export type Delta = "added" | "removed" | "modified" | "unchanged";
export function delta(
  p: { current: boolean; target: boolean; changed: boolean },
  mode: State,
): Delta {
  return mode !== "transition"
    ? p.changed
      ? "modified"
      : "unchanged"
    : !p.current && p.target
      ? "added"
      : p.current && !p.target
        ? "removed"
        : p.changed
          ? "modified"
          : "unchanged";
}
const kinds: Record<Participant["type"], NodeKind> = {
  actor: "ui",
  application: "app",
  service: "service",
  "API gateway": "route",
  "integration platform": "service",
  "event broker": "queue",
  queue: "queue",
  datastore: "datastore",
  SaaS: "external",
  "external organization": "external",
  other: "other",
};
const edgeKinds: Record<Interaction["pattern"], EdgeKind> = {
  "not specified": "other",
  "synchronous request": "call",
  "asynchronous message": "event",
  return: "call",
  "self-action": "call",
  "data access": "data",
  dependency: "dependency",
  other: "other",
};
export const messageKind = (i: Interaction): MessageKind =>
  i.pattern === "self-action"
    ? "self"
    : i.pattern === "asynchronous message"
      ? "async"
      : i.pattern === "return"
        ? "return"
        : "sync";
const label = (s: string) => s.trim().slice(0, 120);
export const messageFor = (i: Interaction, mode: State) => ({
  id: `message-${i.id}`,
  from: i.fromParticipantId,
  to: i.toParticipantId,
  label: label([i.action, i.technology, i.payload].filter(Boolean).join(" · ")),
  kind: messageKind(i),
  delta: delta(i, mode),
  animated: i.animated,
  ...(/^\d+$/.test(i.frequency) &&
  Number(i.frequency) >= 1 &&
  Number(i.frequency) <= 1000000
    ? { repeat: Number(i.frequency) }
    : {}),
  ...(i.resilience ? { note: i.resilience } : {}),
});
export function translateValidation(s: Scenario, path = ""): string {
  const match = path.match(/(?:messages|edges)\[(\d+)\]/);
  if (match) {
    const i = s.interactions[Number(match[1])];
    return `The preview cannot show “${i?.action || "this interaction"}”. Check its participants, action, and state in the interaction table.`;
  }
  if (path.includes("walkthrough"))
    return "The preview cannot include the walkthrough. Complete its headings and explanations, and choose participants or interactions that exist in this state.";
  return `The preview cannot update for “${s.name || "this scenario"}”. Check participant names, boundaries, and the highlighted architecture checks.`;
}
export type CompileResult =
  | {
      ok: true;
      graph: GraphDoc;
      horizontalBoundaryIds: string[];
      stretchParticipantIds: string[];
      omitted: { id: string; position: number; action: string }[];
    }
  | { ok: false; messages: string[] };
export function compileScenario(
  s: Scenario,
  catalog: Participant[],
  state: State,
): CompileResult {
  s = projectInteractions(s, state);
  const checksScenario =
    state === "transition"
      ? s
      : {
          ...s,
          interactions: s.interactions
            .filter((i) => included(i, state))
            .map((i) => ({
              ...i,
              current: state === "current",
              target: state === "target",
            })),
        };
  const blockers = architectureChecks(checksScenario, catalog).filter(
    (c) => c.blocking,
  );
  if (blockers.length)
    return { ok: false, messages: blockers.map((c) => c.message) };
  const placements = s.participantPlacements.filter((p) => included(p, state));
  const omitted = s.interactions.flatMap((i, n) =>
    included(i, state) && isPendingDraft(i)
      ? [{ id: i.id, position: n + 1, action: i.action }]
      : [],
  );
  const interactions = s.interactions.filter(
    (i) => included(i, state) && !isPendingDraft(i),
  );
  if (!placements.length)
    return {
      ok: false,
      messages: [
        `No participants are included in the ${state} presentation. Add a participant to this state.`,
      ],
    };
  const flow = placements.length >= 2 && interactions.length > 0;
  const nodeIds = new Set(placements.map((p) => p.participantId));
  const interactionIds = new Set(interactions.map((i) => i.id));
  const steps = s.walkthroughSteps
    .filter(
      (step) =>
        step.heading.trim() &&
        step.explanation.trim() &&
        (step.stage === "architecture" || flow),
    )
    .flatMap((step) => {
      const nodes = step.participantIds.filter((id) => nodeIds.has(id));
      const refs = step.interactionIds.filter((id) => interactionIds.has(id));
      if (
        (step.participantIds.length || step.interactionIds.length) &&
        !nodes.length &&
        !refs.length
      )
        return [];
      return [
        {
          id: step.id,
          heading: step.heading.slice(0, 48),
          body: step.explanation,
          stage: {
            kind: "view" as const,
            view:
              step.stage === "architecture"
                ? "view-architecture"
                : "view-sequence",
          },
          focus:
            nodes.length || refs.length
              ? {
                  kind: "selection" as const,
                  nodes,
                  ...(step.stage === "architecture"
                    ? { edges: refs.map((id) => `edge-${id}`) }
                    : { messages: refs.map((id) => `message-${id}`) }),
                }
              : { kind: "all" as const },
        },
      ];
    });
  // Compact each boundary by default; these rank hints are floors, so the
  // renderer can still add depth and routing space for interaction flows.
  const nextRowByBoundary = new Map<string, number>();
  const participantRanks = Object.fromEntries(
    placements.map((p) => {
      const row = nextRowByBoundary.get(p.boundaryId) ?? 0;
      nextRowByBoundary.set(p.boundaryId, row + 1);
      return [p.participantId, row];
    }),
  );
  const input: GraphDocInput = {
    schemaVersion: SCHEMA_VERSION,
    kind: "graph",
    id: s.id,
    title: label(s.name),
    ...(s.businessOutcome.trim() ? { summary: s.businessOutcome } : {}),
    lenses: flow ? ["architecture", "data-flow"] : ["architecture"],
    provenance: {
      repo: { owner: "local", name: "integration-scenario-studio" },
      base: { sha: "0000000" },
      head: { sha: "0000000" },
      generator: { name: "Integration Scenario Studio", version: "0.1.0" },
    },
    lanes: s.boundaries.map((b, n) => ({
      id: b.id,
      label: label(b.name),
      ...(b.subtitle.trim() ? { subtitle: label(b.subtitle) } : {}),
      order: Math.min(n, 64),
    })),
    nodes: placements.map((p) => {
      const c = catalog.find((c) => c.id === p.participantId)!;
      return {
        id: c.id,
        label: label(c.name),
        kind: kinds[c.type],
        lane: p.boundaryId,
        delta: delta(p, s.mode),
        subtitle: label(p.subtitle || c.type),
        badges: p.badges.filter(Boolean).map(label),
        ...(c.description ? { summary: c.description } : {}),
      };
    }),
    edges: interactions.map((i) => ({
      id: `edge-${i.id}`,
      from: i.fromParticipantId,
      to: i.toParticipantId,
      kind: edgeKinds[i.pattern],
      delta: delta(i, s.mode),
      label: label([i.action, i.technology].filter(Boolean).join(" · ")),
      emphasis: i.hero ? "hero" : "normal",
      animated: i.animated,
    })),
    flows: flow
      ? [
          {
            id: "flow-main",
            title: label(s.name),
            delta: s.mode === "transition" ? "modified" : "unchanged",
            participants: sequenceParticipantOrder(
              placements.map((p) => p.participantId),
              interactions,
            ).map((node) => ({ node })),
            messages: interactions.map((i) => messageFor(i, s.mode)),
          },
        ]
      : [],
    views: [
      {
        id: "view-architecture",
        title: "Architecture overview",
        lens: "architecture",
      },
      ...(flow
        ? [
            {
              id: "view-sequence",
              title: "Sequence flow",
              lens: "data-flow" as const,
            },
          ]
        : []),
    ],
    ...(steps.length >= 2 ? { walkthrough: { steps } } : {}),
    layout: {
      direction: "right",
      laneOrder: s.boundaries.map((b) => b.id),
      rank: participantRanks,
    },
  };
  try {
    const result = safeParseGraphDoc(input);
    return result.ok
      ? {
          ok: true,
          graph: result.value,
          omitted,
          stretchParticipantIds: placements
            .filter((p) => p.displayHints?.stretchToFill)
            .map((p) => p.participantId),
          horizontalBoundaryIds: s.boundaries
            .filter((b) => b.orientation === "horizontal")
            .map((b) => b.id),
        }
      : {
          ok: false,
          messages: [
            ...new Set(
              result.error.issues.map((i) => translateValidation(s, i.path)),
            ),
          ],
        };
  } catch {
    return { ok: false, messages: [translateValidation(s)] };
  }
}
export function renderPreview(
  graph: GraphDoc,
  lens: "architecture" | "data-flow",
  theme: "light" | "dark" = "light",
  horizontalBoundaryIds: readonly string[] = [],
  stretchParticipantIds: readonly string[] = [],
): RenderedSvg | undefined {
  if (!graph.lenses.includes(lens)) return undefined;
  const rendered =
    lens === "architecture" &&
    (horizontalBoundaryIds.some((id) =>
      graph.nodes.some((node) => node.lane === id),
    ) ||
      stretchParticipantIds.some((id) =>
        graph.nodes.some((node) => node.id === id),
      ))
      ? renderPlatforms(
          graph,
          horizontalBoundaryIds,
          theme,
          stretchParticipantIds,
        )
      : render(graph, { lens, theme });
  return lens === "architecture"
    ? sequenceArchitectureTraffic(graph, rendered)
    : rendered;
}
