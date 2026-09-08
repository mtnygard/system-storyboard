import type { Interaction } from "./model";
export function missingDetails(i: Interaction): string[] {
  return [
    !i.action.trim() && "action",
    !i.fromParticipantId && "sender",
    !i.toParticipantId && "receiver",
    i.pattern === "not specified" && "pattern",
  ].filter(Boolean) as string[];
}
export const isPendingDraft = (i: Interaction) =>
  i.draft && missingDetails(i).length > 0;
