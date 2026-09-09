import type { Participant } from "./model";

export type CapturedLine = {
  action: string;
  fromParticipantId: string;
  toParticipantId: string;
  error?: string;
};

const quotes = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
];

function endpoint(text: string, catalog: Participant[], start: boolean) {
  const matches = catalog.flatMap((participant) => {
    const name = participant.name.trim();
    if (!name) return [];
    const forms = [name, ...quotes.map(([open, close]) => open + name + close)];
    return forms.flatMap((form) => {
      const candidate = start
        ? text.slice(0, form.length)
        : text.slice(-form.length);
      const separator = start
        ? text[form.length]
        : text[text.length - form.length - 1];
      return candidate.toLowerCase() === form.toLowerCase() &&
        separator &&
        /\s/.test(separator)
        ? [{ participant, length: form.length }]
        : [];
    });
  });
  // Prefer "Order Processing Service" over a catalog entry named "Order".
  const longest = Math.max(0, ...matches.map((match) => match.length));
  return matches.filter((match) => match.length === longest);
}

/** Recognize catalog names at both ends; the text between them is the action. */
export function parseCaptureLine(
  line: string,
  catalog: Participant[],
): CapturedLine {
  const text = line.trim();
  const fallback = { action: text, fromParticipantId: "", toParticipantId: "" };
  const from = endpoint(text, catalog, true);
  const to = endpoint(text, catalog, false);
  if (!from.length || !to.length) return fallback;
  const action = text.slice(from[0].length, text.length - to[0].length).trim();
  if (!action) return fallback;
  if (from.length > 1 || to.length > 1) {
    return {
      ...fallback,
      error:
        "More than one participant has this name. Give participants distinct names in the catalog before capturing this line.",
    };
  }
  return {
    action,
    fromParticipantId: from[0].participant.id,
    toParticipantId: to[0].participant.id,
  };
}
