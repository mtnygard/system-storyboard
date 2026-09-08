import { isPendingDraft, missingDetails } from "./drafts";
import type { Scenario, Participant, State } from "./model";
export type Check = {
  id: string;
  severity:
    | "Incomplete description"
    | "Internal inconsistency"
    | "Diagram readability"
    | "Advisory recommendation";
  message: string;
  subject?: string;
  section: "Overview" | "Participants" | "Interactions" | "Walkthrough";
  blocking?: boolean;
};
export const included = (
  p: { current: boolean; target: boolean },
  state: State,
) => (state === "transition" ? p.current || p.target : p[state]);
export function architectureChecks(
  s: Scenario,
  catalog: Participant[],
): Check[] {
  const out: Check[] = [];
  const add = (
    severity: Check["severity"],
    message: string,
    section: Check["section"],
    subject?: string,
    blocking = false,
  ) =>
    out.push({
      id: `check-${out.length}`,
      severity,
      message,
      section,
      subject,
      blocking,
    });
  if (!s.name.trim())
    add(
      "Incomplete description",
      "Give this scenario a name so its preview can be shown.",
      "Overview",
      undefined,
      true,
    );
  for (const [key, label] of [
    ["trigger", "business trigger"],
    ["businessOutcome", "business outcome"],
    ["completionOutcome", "completion outcome"],
  ] as const)
    if (!s[key].trim())
      add(
        "Incomplete description",
        `What is the ${label}? Add it to give reviewers context.`,
        "Overview",
      );
  if (!s.participantPlacements.length)
    add(
      "Incomplete description",
      "Add a participant to start the architecture preview.",
      "Participants",
      undefined,
      true,
    );
  if (!s.interactions.length)
    add(
      "Incomplete description",
      "Add an interaction to explain how this scenario unfolds.",
      "Interactions",
    );
  if (s.boundaries.length > 6)
    add(
      "Diagram readability",
      `This scenario uses ${s.boundaries.length} boundaries. Could related participants share a boundary?`,
      "Participants",
    );
  if (new Set(s.boundaries.map((b) => b.dimension)).size > 1)
    add(
      "Advisory recommendation",
      "The boundaries mix classification dimensions. Could they use one primary dimension?",
      "Participants",
    );
  for (const b of s.boundaries)
    if (!b.name.trim())
      add(
        "Incomplete description",
        "Name the empty boundary so it can appear in the preview.",
        "Participants",
        b.id,
        true,
      );
  for (const p of s.participantPlacements) {
    const participant = catalog.find((c) => c.id === p.participantId),
      name = participant?.name || "Unnamed participant";
    if (!participant)
      add(
        "Internal inconsistency",
        "A participant is missing from the catalog. Remove its placement or add it again.",
        "Participants",
        p.participantId,
        true,
      );
    else if (!participant.name.trim())
      add(
        "Incomplete description",
        "Name the selected participant so it can appear in the preview.",
        "Participants",
        p.participantId,
        true,
      );
    if (!s.boundaries.some((b) => b.id === p.boundaryId))
      add(
        "Internal inconsistency",
        `${name} is outside every boundary. Choose a boundary.`,
        "Participants",
        p.participantId,
        true,
      );
    if (
      catalog.filter(
        (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
      ).length > 1
    )
      add(
        "Advisory recommendation",
        `More than one participant is named “${name}”. Would a more specific name help?`,
        "Participants",
        p.participantId,
      );
    if (!p.current && !p.target)
      add(
        "Advisory recommendation",
        `${name} is hidden from both states. Is that intentional?`,
        "Participants",
        p.participantId,
      );
  }
  for (const [n, i] of s.interactions.entries()) {
    if (isPendingDraft(i)) {
      add(
        "Incomplete description",
        `Step ${n + 1}${i.action ? ` “${i.action}”` : ""} needs ${missingDetails(i).join(", ")}. Complete these details when ready.`,
        "Interactions",
        i.id,
      );
      continue;
    }
    if (i.pattern === "not specified")
      add(
        "Incomplete description",
        `Step ${n + 1} needs a pattern. Choose how this interaction behaves.`,
        "Interactions",
        i.id,
        true,
      );
    const title = i.action.trim() ? `“${i.action}”` : `Step ${n + 1}`;
    if (!i.action.trim())
      add(
        "Incomplete description",
        `Step ${n + 1} needs an action. Describe what is sent or done.`,
        "Interactions",
        i.id,
        true,
      );
    for (const [key, role] of [
      ["fromParticipantId", "sender"],
      ["toParticipantId", "destination"],
    ] as const) {
      const p = s.participantPlacements.find((p) => p.participantId === i[key]);
      if (!p)
        add(
          "Internal inconsistency",
          `${title} refers to a missing ${role}. Choose a participant or delete the interaction.`,
          "Interactions",
          i.id,
          true,
        );
      else
        for (const state of (s.mode === "transition"
          ? ["current", "target"]
          : [s.mode]) as ("current" | "target")[]) {
          if (i[state] && !p[state])
            add(
              "Internal inconsistency",
              `${title} uses ${catalog.find((c) => c.id === p.participantId)?.name || "a participant"} in the ${state} state, where it is not included. Change its presence or the interaction’s state.`,
              "Interactions",
              i.id,
              true,
            );
        }
    }
    if (
      (i.pattern === "self-action") !==
        (i.fromParticipantId === i.toParticipantId) &&
      i.fromParticipantId &&
      i.toParticipantId
    )
      add(
        "Internal inconsistency",
        `${title}: a self-action must use the same participant as sender and destination. Adjust the pattern or participants.`,
        "Interactions",
        i.id,
        true,
      );
    if (
      i.pattern === "synchronous request" &&
      !i.resilience.trim() &&
      !i.failure.trim() &&
      !s.interactions.some(
        (r) =>
          r.pattern === "return" &&
          r.fromParticipantId === i.toParticipantId &&
          r.toParticipantId === i.fromParticipantId &&
          ((r.current && i.current) || (r.target && i.target)),
      )
    )
      add(
        "Advisory recommendation",
        `${title} has no return, timeout, or failure behavior. How does the caller recover?`,
        "Interactions",
        i.id,
      );
    if (
      i.pattern === "asynchronous message" &&
      catalog.find((p) => p.id === i.fromParticipantId)?.type ===
        "event broker" &&
      !s.interactions.some(
        (r) =>
          r.toParticipantId === i.fromParticipantId &&
          r.payload === i.payload &&
          r.pattern === "asynchronous message" &&
          ((r.current && i.current) || (r.target && i.target)),
      )
    )
      add(
        "Advisory recommendation",
        `${i.payload || title} has no apparent producer. Which interaction publishes it?`,
        "Interactions",
        i.id,
      );
    if (i.action.length > 60)
      add(
        "Diagram readability",
        `${title} is long for a diagram. Could the action be shorter?`,
        "Interactions",
        i.id,
      );
  }
  if (s.participantPlacements.length > 12)
    add(
      "Diagram readability",
      "The sequence preview supports up to 12 participants. Split this story into smaller scenarios.",
      "Participants",
      undefined,
      true,
    );
  if (s.interactions.length > 64)
    add(
      "Diagram readability",
      "The sequence preview supports up to 64 interactions. Split this story into smaller scenarios.",
      "Interactions",
      undefined,
      true,
    );
  if (s.boundaries.length > 16)
    add(
      "Diagram readability",
      "The preview supports up to 16 boundaries. Combine related boundaries.",
      "Participants",
      undefined,
      true,
    );
  for (const step of s.walkthroughSteps) {
    if (!step.heading.trim() || !step.explanation.trim())
      add(
        "Incomplete description",
        "Complete the heading and explanation of this walkthrough card.",
        "Walkthrough",
        step.id,
      );
    if (
      step.participantIds.some(
        (id) => !s.participantPlacements.some((p) => p.participantId === id),
      ) ||
      step.interactionIds.some((id) => !s.interactions.some((i) => i.id === id))
    )
      add(
        "Internal inconsistency",
        `“${step.heading}” focuses something that was removed. Choose its focus again.`,
        "Walkthrough",
        step.id,
      );
  }
  return out;
}
