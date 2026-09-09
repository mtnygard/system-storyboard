import type { GraphDoc } from "@coldtea/pr-lens-schema";
import {
  paletteFor,
  emptyAtlas,
  type RenderedSvg,
} from "@coldtea/pr-lens-renderer";
import { layoutPlatforms } from "./platform-layout";
import {
  measure,
  badgeRow,
  curveBounds,
  placeLabelPills,
  paintCard,
  paintLabelPill,
  svgDocument,
  shifted,
  markerFor,
  toneFor,
  toneColour,
  travellingPulses,
  tag,
  textNode,
  wrap,
  lines,
  atlasBoxes,
  canvasFor,
  union,
  DIAGRAM_MARGIN,
  LANE_TOP,
  LANE_HEADER_BASELINE,
  LANE_PADDING_X,
  LANE_RADIUS,
} from "./renderer-internals";

function headerText(text: string, width: number): string {
  const characters = [...text.toUpperCase()];
  const fits = (value: string) =>
    measure(value, "sans-bold", 10) + [...value].length * 1.2 <= width;
  if (fits(characters.join(""))) return characters.join("");
  while (characters.length && !fits(characters.join("") + "…"))
    characters.pop();
  return characters.join("") + "…";
}

export function renderPlatforms(
  doc: GraphDoc,
  horizontalIds: readonly string[],
  theme: "light" | "dark",
  stretchIds: readonly string[] = [],
): RenderedSvg {
  const { layout, visibleLanes, routed } = layoutPlatforms(
    doc,
    horizontalIds,
    stretchIds,
  );
  const palette = paletteFor(theme);
  const pills = placeLabelPills(routed);
  const edgeMarkup = routed.map(({ edge, path }) => {
    const tone = toneFor(edge.delta);
    const colour = toneColour(palette, tone);
    return lines([
      edge.emphasis === "hero"
        ? tag("path", { class: "glow", stroke: colour, d: path })
        : "",
      tag("path", {
        class: [
          "edge",
          `edge-${tone}`,
          edge.emphasis === "hero" ? "hero" : "",
          edge.emphasis === "muted" ? "faded" : "",
          edge.delta === "unchanged" ? "context" : "",
        ]
          .filter(Boolean)
          .join(" "),
        d: path,
        "marker-end": markerFor(tone),
      }),
      edge.animated ? travellingPulses({ path, colour, count: 1, lag: 0 }) : "",
    ]);
  });
  const pillMarkup = routed.map(({ edge }) => {
    const box = pills.get(edge.id);
    return box && edge.label
      ? paintLabelPill(edge.label, box, toneFor(edge.delta))
      : "";
  });
  const canvas = canvasFor(
    layout,
    union([
      ...visibleLanes.map(({ box }) => box),
      ...layout.nodes.flatMap((node) => [
        node.box,
        ...(badgeRow(node) ? [badgeRow(node)!.box] : []),
      ]),
      ...pills.values(),
      ...routed.map(({ curve }) => curveBounds(curve)),
    ]),
    DIAGRAM_MARGIN,
  );
  const paintParticipant = (placed: (typeof layout.nodes)[number]) => {
    const markup = paintCard(placed);
    const naturalHeight = placed.node.subtitle === undefined ? 52 : 62;
    const offset = (placed.box.height - naturalHeight) / 2;
    if (offset <= 0) return markup;
    // PR Lens centers the icon in the card; center its horizontal text block too.
    return markup.replace(
      /(<text\b[^>]*class="(?:ntitle(?: strike)?|nsub)"[^>]*\by=")([^"]+)(")/g,
      (_match, before: string, y: string, after: string) =>
        before + (Number(y) + offset) + after,
    );
  };
  const body = shifted(
    canvas,
    lines([
      wrap(
        "g",
        {},
        lines(
          visibleLanes.map(({ lane, box }) =>
            lines([
              tag("rect", { class: "lanebox", ...box, rx: LANE_RADIUS }),
              textNode(
                {
                  class: "lanelabel",
                  x: box.x + LANE_PADDING_X,
                  y: box.y + LANE_HEADER_BASELINE - LANE_TOP,
                },
                headerText(
                  [lane.label, lane.subtitle].filter(Boolean).join(" · "),
                  box.width - LANE_PADDING_X * 2,
                ),
              ),
            ]),
          ),
        ),
      ),
      wrap("g", {}, lines(edgeMarkup)),
      wrap("g", {}, lines(layout.nodes.map(paintParticipant))),
      wrap("g", {}, lines(pillMarkup)),
    ]),
  );
  return {
    svg: svgDocument({
      width: canvas.width,
      height: canvas.height,
      palette,
      title: doc.title,
      description: doc.summary,
      body,
    }),
    width: canvas.width,
    height: canvas.height,
    lens: "architecture",
    theme,
    view: undefined,
    animated: doc.edges.some((edge) => edge.animated),
    atlas: {
      ...emptyAtlas(),
      lanes: atlasBoxes(
        visibleLanes.map(({ lane, box }) => ({ id: lane.id, box })),
        canvas,
      ),
      nodes: atlasBoxes(
        layout.nodes.map(({ node, box }) => ({ id: node.id, box })),
        canvas,
      ),
      edges: atlasBoxes(
        routed.map(({ edge, curve }) => ({
          id: edge.id,
          box: curveBounds(curve),
        })),
        canvas,
      ),
    },
  };
}
