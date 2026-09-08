import { z } from "zod";
export const participantTypes = [
  "actor",
  "application",
  "service",
  "API gateway",
  "integration platform",
  "event broker",
  "queue",
  "datastore",
  "SaaS",
  "external organization",
  "other",
] as const;
export const patterns = [
  "not specified",
  "synchronous request",
  "asynchronous message",
  "return",
  "self-action",
  "data access",
  "dependency",
  "other",
] as const;
export const dimensions = [
  "business domain",
  "platform",
  "trust zone",
  "ownership",
  "deployment location",
  "custom",
] as const;
export const modes = ["current", "target", "transition"] as const;
export type State = (typeof modes)[number];
const id = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
  .max(100);
const text = z.string().max(2000);
const name = z.string().max(120);
const presence = {
  current: z.boolean(),
  target: z.boolean(),
  changed: z.boolean(),
};
export const ParticipantSchema = z.object({
  id,
  name,
  type: z.enum(participantTypes),
  description: text.default(""),
  domain: name.default(""),
  owner: name.default(""),
  location: name.default(""),
  trustZone: name.default(""),
  lifecycle: name.default(""),
});
export const BoundarySchema = z.object({
  id,
  name,
  subtitle: name.default(""),
  dimension: z.enum(dimensions),
  order: z.number().int().min(0),
});
export const PlacementSchema = z.object({
  participantId: id,
  boundaryId: z.string().max(100),
  ...presence,
  subtitle: name.default(""),
  badges: z.array(name).max(6).default([]),
});
const BaseInteractionSchema = z.object({
  id,
  fromParticipantId: z.string().max(100),
  toParticipantId: z.string().max(100),
  action: name,
  pattern: z.enum(patterns),
  draft: z.boolean().default(false),
  technology: name.default(""),
  payload: name.default(""),
  frequency: name.default(""),
  volume: name.default(""),
  latency: name.default(""),
  authentication: name.default(""),
  dataClassification: name.default(""),
  resilience: text.default(""),
  failure: text.default(""),
  ...presence,
  animated: z.boolean(),
  hero: z.boolean(),
});
export const InteractionSchema = BaseInteractionSchema.extend({
  targetOverrides: BaseInteractionSchema.omit({
    id: true,
    current: true,
    target: true,
    changed: true,
  })
    .partial()
    .optional(),
});
export const StepSchema = z.object({
  id,
  heading: z.string().max(48),
  explanation: z.string().max(140),
  stage: z.enum(["architecture", "sequence"]),
  participantIds: z.array(id).max(256),
  interactionIds: z.array(id).max(64),
});
export const ScenarioSchema = z.object({
  id,
  name,
  businessOutcome: text,
  trigger: text,
  completionOutcome: text,
  mode: z.enum(modes),
  boundaries: z.array(BoundarySchema).max(64),
  participantPlacements: z.array(PlacementSchema).max(256),
  interactions: z.array(InteractionSchema).max(512),
  walkthroughSteps: z.array(StepSchema).max(12),
});
export const WorkspaceSchema = z.object({
  version: z.literal(1),
  id,
  name,
  participants: z.array(ParticipantSchema).max(2000),
  scenarios: z.array(ScenarioSchema).max(100),
});
export type Participant = z.infer<typeof ParticipantSchema>;
export type Boundary = z.infer<typeof BoundarySchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type Interaction = z.infer<typeof InteractionSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const newParticipant = (name = "New participant"): Participant =>
  ParticipantSchema.parse({ id: uid("p"), name, type: "service" });
export const newInteraction = (mode: State = "transition"): Interaction =>
  InteractionSchema.parse({
    id: uid("i"),
    fromParticipantId: "",
    toParticipantId: "",
    action: "",
    pattern: "not specified",
    draft: true,
    current: mode !== "target",
    target: mode !== "current",
    changed: false,
    animated: true,
    hero: false,
  });
export const newScenario = (name = "Untitled scenario"): Scenario => ({
  id: uid("s"),
  name,
  businessOutcome: "",
  trigger: "",
  completionOutcome: "",
  mode: "current",
  boundaries: [
    {
      id: uid("b"),
      name: "Enterprise",
      subtitle: "",
      dimension: "business domain",
      order: 0,
    },
  ],
  participantPlacements: [],
  interactions: [],
  walkthroughSteps: [],
});
export const newPlacement = (
  participantId: string,
  boundaryId: string,
  mode: State,
): Placement => ({
  participantId,
  boundaryId,
  current: mode !== "target",
  target: mode !== "current",
  changed: false,
  subtitle: "",
  badges: [],
});
export function reorder<T>(items: T[], index: number, direction: number): T[] {
  const next = [...items];
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}
export function generateWalkthrough(
  s: Scenario,
  participants: Participant[],
): Step[] {
  const title = (id: string) =>
    participants.find((p) => p.id === id)?.name || "Participant";
  return [
    {
      id: uid("step"),
      heading: "The architecture at a glance",
      explanation: (
        s.businessOutcome ||
        "Explore the participants and their responsibilities."
      ).slice(0, 140),
      stage: "architecture" as const,
      participantIds: [],
      interactionIds: [],
    },
    ...s.interactions.slice(0, 11).map((i) => ({
      id: uid("step"),
      heading: (i.action || "Describe this interaction").slice(0, 48),
      explanation:
        `${title(i.fromParticipantId)} → ${title(i.toParticipantId)}${i.payload ? `: ${i.payload}` : "."}`.slice(
          0,
          140,
        ),
      stage: "sequence" as const,
      participantIds: [i.fromParticipantId, i.toParticipantId].filter(Boolean),
      interactionIds: [i.id],
    })),
  ];
}
