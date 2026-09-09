import { expect, it } from "vitest";
import {
  newScenario,
  newParticipant,
  newPlacement,
  newInteraction,
  WorkspaceSchema,
} from "../domain/model";
import { compileScenario, renderPreview } from "./compiler";
import { layoutPlatforms } from "./platform-layout";
import { scenarioDiagramVariants } from "./diagram-export";

function fixture() {
  const scenario = newScenario("Platform example");
  const boundary = scenario.boundaries[0];
  scenario.boundaries = [
    "Portal",
    "Orders",
    "Inventory",
    "Shared platform",
  ].map((name, index) => ({
    ...boundary,
    id: `b-${index}`,
    name,
    order: index,
    orientation: index === 3 ? "horizontal" : "vertical",
  }));
  const catalog = [
    "Web app",
    "Order service",
    "Stock service",
    "Identity",
    "Telemetry",
    "Messaging",
    "Cache",
  ].map(newParticipant);
  scenario.participantPlacements = catalog.map((p, index) =>
    newPlacement(p.id, `b-${Math.min(index, 3)}`, "current"),
  );
  return { scenario, catalog };
}
function compile(f = fixture()) {
  const result = compileScenario(f.scenario, f.catalog, f.scenario.mode);
  if (!result.ok) throw Error(result.messages.join());
  return { ...f, ...result };
}
it("spans columns with a platform band and wraps its participants in author order", () => {
  const { graph, horizontalBoundaryIds, catalog } = compile();
  const rendered = renderPreview(
    graph,
    "architecture",
    "light",
    horizontalBoundaryIds,
  )!;
  const { lanes, nodes } = rendered.atlas;
  const platform = lanes["b-3"];
  expect(platform.x).toBe(lanes["b-0"].x);
  expect(platform.width).toBe(lanes["b-2"].x + lanes["b-2"].width - platform.x);
  expect(platform.y).toBeGreaterThan(lanes["b-0"].y + lanes["b-0"].height);
  const cards = catalog.slice(3).map((p) => nodes[p.id]);
  expect(cards[0].y).toBe(cards[1].y);
  expect(cards[1].y).toBe(cards[2].y);
  expect(cards[0].x).toBeLessThan(cards[1].x);
  expect(cards[1].x).toBeLessThan(cards[2].x);
  expect(cards[3].x).toBe(cards[0].x);
  expect(cards[3].y).toBeGreaterThan(cards[0].y);
  for (const card of cards) {
    expect(card.y).toBeGreaterThan(platform.y);
    expect(card.y + card.height).toBeLessThan(platform.y + platform.height);
  }
});
it("supports only horizontal boundaries and multiple platform bands", () => {
  const f = fixture();
  f.scenario.boundaries.forEach((b) => {
    b.orientation = "horizontal";
  });
  const { graph, horizontalBoundaryIds } = compile(f);
  const r = renderPreview(
    graph,
    "architecture",
    "dark",
    horizontalBoundaryIds,
  )!;
  const boxes = f.scenario.boundaries.map((b) => r.atlas.lanes[b.id]);
  for (let index = 1; index < boxes.length; index++) {
    expect(boxes[index].x).toBe(boxes[0].x);
    expect(boxes[index].width).toBe(boxes[0].width);
    expect(boxes[index].y).toBeGreaterThan(
      boxes[index - 1].y + boxes[index - 1].height,
    );
  }
  expect(Object.keys(r.atlas.nodes)).toHaveLength(f.catalog.length);
});
it("routes platform, cross-column, return and self interactions clear of unrelated cards", () => {
  const f = fixture();
  const connections = [
    [0, 1],
    [1, 2],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 0],
    [4, 4],
    [3, 5],
    [6, 3],
  ];
  f.scenario.interactions = connections.map(([from, to]) => ({
    ...newInteraction("current"),
    fromParticipantId: f.catalog[from].id,
    toParticipantId: f.catalog[to].id,
    action: "Request",
    pattern: from === to ? "self-action" : "synchronous request",
    draft: false,
  }));
  const { graph, horizontalBoundaryIds } = compile(f);
  const { layout, routed } = layoutPlatforms(graph, horizontalBoundaryIds);
  expect(routed).toHaveLength(connections.length);
  for (const route of routed) {
    let previous = route.curve.from;
    for (const segment of route.curve.segments) {
      for (let n = 0; n <= 40; n++) {
        const t = n / 40,
          u = 1 - t;
        const point =
          segment.kind === "line"
            ? {
                x: previous.x * u + segment.to.x * t,
                y: previous.y * u + segment.to.y * t,
              }
            : {
                x:
                  u ** 3 * previous.x +
                  3 * u ** 2 * t * segment.first.x +
                  3 * u * t ** 2 * segment.second.x +
                  t ** 3 * segment.to.x,
                y:
                  u ** 3 * previous.y +
                  3 * u ** 2 * t * segment.first.y +
                  3 * u * t ** 2 * segment.second.y +
                  t ** 3 * segment.to.y,
              };
        for (const { node, box } of layout.nodes) {
          if (node.id === route.edge.from || node.id === route.edge.to)
            continue;
          const intersects =
            point.x > box.x &&
            point.x < box.x + box.width &&
            point.y > box.y &&
            point.y < box.y + box.height;
          expect(
            intersects,
            `Route ${route.edge.id} crosses ${node.label}`,
          ).toBe(false);
        }
      }
      previous = segment.to;
    }
  }
  const r = renderPreview(
    graph,
    "architecture",
    "dark",
    horizontalBoundaryIds,
  )!;
  expect(r.svg).toContain("data-studio-interaction");
});
it("preserves sequence layout, exports platform diagrams, and retains orientation in stored workspaces", () => {
  const f = fixture();
  f.scenario.interactions = [
    {
      ...newInteraction("current"),
      fromParticipantId: f.catalog[0].id,
      toParticipantId: f.catalog[3].id,
      action: "Authenticate",
      pattern: "synchronous request",
      draft: false,
    },
  ];
  const { graph, horizontalBoundaryIds } = compile(f);
  expect(
    renderPreview(graph, "data-flow", "light", horizontalBoundaryIds),
  ).toEqual(renderPreview(graph, "data-flow", "light"));
  const expected = renderPreview(
    graph,
    "architecture",
    "light",
    horizontalBoundaryIds,
  )!.svg;
  expect(scenarioDiagramVariants(f.scenario, f.catalog, "light")[0].svg).toBe(
    expected,
  );
  const stored = WorkspaceSchema.parse({
    version: 1,
    id: "workspace",
    name: "Example",
    participants: f.catalog,
    scenarios: [f.scenario],
  });
  expect(stored.scenarios[0].boundaries[3].orientation).toBe("horizontal");
});
it("keeps legacy boundaries vertical and handles a platform hidden in the current state", () => {
  const f = fixture();
  f.scenario.participantPlacements.slice(3).forEach((p) => {
    p.current = false;
    p.target = true;
  });
  const { graph, horizontalBoundaryIds } = compile(f);
  expect(
    renderPreview(graph, "architecture", "light", horizontalBoundaryIds),
  ).toEqual(renderPreview(graph, "architecture", "light"));
  const legacy = newScenario();
  expect(legacy.boundaries[0].orientation).toBeUndefined();
});
