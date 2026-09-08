import type { GraphDoc } from "@coldtea/pr-lens-schema";
import type { RenderedSvg } from "@coldtea/pr-lens-renderer";

/** Adapt PR Lens 0.2.2's independent architecture pulses into a shared story
 * clock. Its edge paths and atlas entries have the same renderer-owned order;
 * graph edge order supplies the authoring order. No layout or package edits.
 * Match only renderer-generated markup, never author text (which is escaped).
 */
export function sequenceArchitectureTraffic(
  graph: GraphDoc,
  rendered: RenderedSvg,
): RenderedSvg {
  const counts = new Map(
    graph.flows.flatMap((flow) =>
      flow.messages.map(
        (message) =>
          [
            message.id.replace(/^message-/, "edge-"),
            Math.min(message.repeat ?? 1, 3),
          ] as const,
      ),
    ),
  );
  let slotCount = 0;
  const slots = new Map(
    graph.edges
      .filter((edge) => edge.animated)
      .map((edge) => {
        const count = counts.get(edge.id) ?? 1;
        const slot = { start: slotCount, count };
        slotCount += count;
        return [edge.id, slot] as const;
      }),
  );
  if (!slotCount) return rendered;
  const edgeIds = Object.keys(rendered.atlas.edges);
  let edgeIndex = 0;
  const duration = `${Number((slotCount * 1.4).toFixed(3))}s`;
  const ratio = (value: number) => String(Number(value.toFixed(8)));
  const svg = rendered.svg.replace(
    /(<path\b(?=[^>]*\bclass="edge\s)[^>]*\/>)(\s*(?:<circle\b[^>]*>[\s\S]*?<\/circle>\s*)*)/g,
    (_match, pathTag: string, pulses: string) => {
      const edgeId = edgeIds[edgeIndex++];
      const slot = slots.get(edgeId);
      if (!slot) return pathTag + pulses;
      const circle = pulses.match(/<circle\b([^>]*)>/)?.[1];
      const path = pulses.match(/<animateMotion\b[^>]*\bpath="([^"]*)"/)?.[1];
      if (!circle || !path)
        throw new Error(
          "Architecture pulse markup is incompatible with Studio timing",
        );
      return (
        pathTag +
        Array.from({ length: slot.count }, (_, repeat) => {
          const start = (slot.start + repeat) / slotCount;
          const end = (slot.start + repeat + 1) / slotCount;
          const ramp = 0.08 / slotCount;
          return `<circle${circle} opacity="0" data-studio-interaction="${edgeId}" data-studio-slot="${slot.start + repeat}"><animateMotion dur="${duration}" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;${ratio(start)};${ratio(end)};1" calcMode="linear" path="${path}"/><animate attributeName="opacity" dur="${duration}" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;${ratio(start)};${ratio(start + ramp)};${ratio(end - ramp)};${ratio(end)};1"/></circle>`;
        }).join("")
      );
    },
  );
  if (edgeIndex !== edgeIds.length)
    throw new Error(
      "Architecture edge markup is incompatible with Studio timing",
    );
  return { ...rendered, svg };
}
