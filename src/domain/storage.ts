import { z } from "zod";
import {
  WorkspaceSchema,
  ScenarioSchema,
  ParticipantSchema,
  uid,
  newInteraction,
  newPlacement,
  type Workspace,
  type Scenario,
  type Participant,
} from "./model";
import { seedWorkspace } from "./seed";
export const STORAGE_KEY = "integration-scenario-studio.v1";
function unique(ids: string[]) {
  return new Set(ids).size === ids.length;
}
export function validateWorkspace(value: unknown): Workspace {
  const w = WorkspaceSchema.parse(value);
  if (
    !unique(w.participants.map((p) => p.id)) ||
    !unique(w.scenarios.map((s) => s.id))
  )
    throw Error("Duplicate identities");
  for (const s of w.scenarios) {
    if (
      !unique(s.boundaries.map((b) => b.id)) ||
      !unique(s.interactions.map((i) => i.id)) ||
      !unique(s.participantPlacements.map((p) => p.participantId)) ||
      !unique(s.walkthroughSteps.map((p) => p.id)) ||
      s.interactions.filter((i) => i.hero).length > 1
    )
      throw Error("Duplicate identities or principal interactions");
  }
  return w;
}
export function loadWorkspace(): { workspace: Workspace; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      workspace: raw ? validateWorkspace(JSON.parse(raw)) : seedWorkspace(),
    };
  } catch {
    return {
      workspace: seedWorkspace(),
      error:
        "Your saved workspace could not be opened. A temporary example is shown. Download your saved data before resetting; it has not been overwritten.",
    };
  }
}
export function saveWorkspace(workspace: Workspace): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(validateWorkspace(workspace)),
    );
    return true;
  } catch {
    return false;
  }
}
export const scenarioExport = (s: Scenario, participants: Participant[]) => ({
  format: "integration-scenario-studio",
  version: 1,
  scenario: s,
  participants: participants.filter((p) =>
    s.participantPlacements.some((x) => x.participantId === p.id),
  ),
});
const ImportSchema = z.object({
  format: z.literal("integration-scenario-studio"),
  version: z.literal(1),
  scenario: ScenarioSchema,
  participants: z.array(ParticipantSchema).max(256),
});
export function importScenario(raw: string, w: Workspace): Workspace {
  if (raw.length > 5_000_000)
    throw Error("This file is too large. Choose a Studio scenario under 5 MB.");
  let doc: z.infer<typeof ImportSchema>;
  try {
    doc = ImportSchema.parse(JSON.parse(raw));
    validateWorkspace({
      version: 1,
      id: "validation",
      name: "Import",
      participants: doc.participants,
      scenarios: [doc.scenario],
    });
  } catch {
    throw Error(
      "This file is not a supported Studio scenario. Choose a scenario JSON exported from this app.",
    );
  }
  if (
    doc.scenario.participantPlacements.some(
      (p) => !doc.participants.some((c) => c.id === p.participantId),
    )
  )
    throw Error(
      "The file is missing catalog participants. Export the original scenario again.",
    );
  const mapping = new Map(doc.participants.map((p) => [p.id, uid("p")]));
  const s = doc.scenario;
  const scenario: Scenario = {
    ...s,
    id: uid("s"),
    participantPlacements: s.participantPlacements.map((p) => ({
      ...p,
      participantId: mapping.get(p.participantId)!,
    })),
    interactions: s.interactions.map((i) => ({
      ...i,
      fromParticipantId:
        mapping.get(i.fromParticipantId) || i.fromParticipantId,
      toParticipantId: mapping.get(i.toParticipantId) || i.toParticipantId,
      targetOverrides: i.targetOverrides
        ? {
            ...i.targetOverrides,
            ...(i.targetOverrides.fromParticipantId === undefined
              ? {}
              : {
                  fromParticipantId:
                    mapping.get(i.targetOverrides.fromParticipantId) ||
                    i.targetOverrides.fromParticipantId,
                }),
            ...(i.targetOverrides.toParticipantId === undefined
              ? {}
              : {
                  toParticipantId:
                    mapping.get(i.targetOverrides.toParticipantId) ||
                    i.targetOverrides.toParticipantId,
                }),
          }
        : undefined,
    })),
    walkthroughSteps: s.walkthroughSteps.map((step) => ({
      ...step,
      participantIds: step.participantIds.map((id) => mapping.get(id) || id),
    })),
  };
  return {
    ...w,
    participants: [
      ...w.participants,
      ...doc.participants.map((p) => ({ ...p, id: mapping.get(p.id)! })),
    ],
    scenarios: [...w.scenarios, scenario],
  };
}
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let n = 0; n < raw.length; n++) {
    const c = raw[n];
    if (c === '"') {
      if (quoted && raw[n + 1] === '"') {
        cell += '"';
        n++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[n + 1] === "\n") n++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted)
    throw Error(
      "A quoted CSV value is unfinished. Close its quotation mark and try again.",
    );
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
export function importCsv(
  raw: string,
  s: Scenario,
  catalog: Participant[],
): Scenario {
  if (raw.length > 1_000_000) throw Error("Choose a CSV under 1 MB.");
  const [header, ...rows] = parseCsv(raw);
  if (!header) throw Error("The CSV is empty.");
  const keys = header.map((h) => h.trim().toLowerCase());
  if (!["from", "action", "to"].every((k) => keys.includes(k)))
    throw Error(
      "Include From, Action, and To column headings. Pattern and Technology are optional.",
    );
  if (rows.length + s.interactions.length > 64)
    throw Error(
      "A scenario supports up to 64 interaction rows. Import a smaller list.",
    );
  const placements = [...s.participantPlacements];
  const interactions = rows.map((row, n) => {
    const value = (k: string) => row[keys.indexOf(k)]?.trim() || "";
    const lookup = (key: string) => {
      const matches = catalog.filter(
        (p) => p.name.trim().toLowerCase() === value(key).toLowerCase(),
      );
      if (matches.length !== 1)
        throw Error(
          `CSV row ${n + 2}: “${value(key)}” must match one catalog participant. Create or rename that participant first.`,
        );
      const p = matches[0];
      if (!placements.some((x) => x.participantId === p.id))
        placements.push(newPlacement(p.id, s.boundaries[0]?.id || "", s.mode));
      return p.id;
    };
    const i = {
      ...newInteraction(s.mode),
      fromParticipantId: lookup("from"),
      toParticipantId: lookup("to"),
      action: value("action"),
      technology: value("technology"),
    };
    const pattern = value("pattern");
    if (pattern) i.pattern = pattern as typeof i.pattern;
    try {
      return importInteraction(i);
    } catch {
      throw Error(
        `CSV row ${n + 2} has an unsupported pattern or a value that is too long. Use the pattern names shown in the table.`,
      );
    }
  });
  return {
    ...s,
    participantPlacements: placements,
    interactions: [...s.interactions, ...interactions],
  };
}
import { InteractionSchema } from "./model";
const importInteraction = (value: unknown) => InteractionSchema.parse(value);
export function download(
  name: string,
  data: string | ArrayBuffer,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
