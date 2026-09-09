import { expect, it } from "vitest";
import { seedWorkspace } from "../domain/seed";
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
import {
  CONTENT_TOP,
  LANE_TOP,
  LANE_BOTTOM_PADDING,
  LANE_PADDING_X,
  ROW_GAP,
} from "./renderer-internals";

function fixture() {
  const scenario = newScenario("Stretch example");
  const first = scenario.boundaries[0];
  scenario.boundaries = [
    { ...first, id: "left", name: "Applications" },
    { ...first, id: "right", name: "Services", order: 1 },
  ];
  const catalog = ["Portal", "Worker", "API", "Queue", "Cache", "Database"].map(
    newParticipant,
  );
  scenario.participantPlacements = catalog.map((p, i) =>
    newPlacement(p.id, i < 2 ? "left" : "right", "current"),
  );
  function stretch(...indices: number[]) {
    scenario.participantPlacements.forEach((p, index) => {
      p.displayHints = { stretchToFill: indices.includes(index) };
    });
  }
  function compile() {
    const result = compileScenario(scenario, catalog, scenario.mode);
    if (!result.ok) throw Error(result.messages.join());
    return result;
  }
  function render() {
    const result = compile();
    return renderPreview(
      result.graph,
      "architecture",
      "light",
      result.horizontalBoundaryIds,
      result.stretchParticipantIds,
    )!;
  }
  return { scenario, catalog, stretch, compile, render };
}

it("fills a vertical boundary while reserving space for fixed participants", () => {
  const f = fixture();
  const original = f.render();
  f.stretch(0);
  const rendered = f.render();
  const lane = rendered.atlas.lanes.left;
  const flex = rendered.atlas.nodes[f.catalog[0].id];
  const fixed = rendered.atlas.nodes[f.catalog[1].id];
  expect(flex.y).toBe(lane.y + CONTENT_TOP - LANE_TOP);
  expect(flex.height).toBeGreaterThan(
    original.atlas.nodes[f.catalog[0].id].height,
  );
  expect(fixed.height).toBe(original.atlas.nodes[f.catalog[1].id].height);
  expect(fixed.y).toBe(flex.y + flex.height + ROW_GAP);
  expect(fixed.y + fixed.height).toBe(
    lane.y + lane.height - LANE_BOTTOM_PADDING,
  );
  expect(rendered.atlas.nodes[f.catalog[5].id].y).toBe(
    original.atlas.nodes[f.catalog[5].id].y,
  );
});

it("divides vertical space proportionally and reflows when a stretched participant is hidden", () => {
  const f = fixture();
  f.stretch(0, 1);
  const result = f.render();
  const a = result.atlas.nodes[f.catalog[0].id],
    b = result.atlas.nodes[f.catalog[1].id];
  expect(a.height).toBe(b.height);
  expect(b.y).toBe(a.y + a.height + ROW_GAP);
  f.scenario.participantPlacements[0].current = false;
  f.scenario.participantPlacements[0].target = true;
  const hidden = f.render();
  expect(hidden.atlas.nodes[f.catalog[0].id]).toBeUndefined();
  expect(hidden.atlas.nodes[f.catalog[1].id].height).toBeCloseTo(
    a.height + b.height + ROW_GAP,
  );
  // Minimum content heights are the weights if participants have different sizes.
  const compiled = f.compile();
  f.scenario.participantPlacements[0].current = true;
  const both = f.compile();
  delete both.graph.nodes.find((p) => p.id === f.catalog[0].id)!.subtitle;
  const unequal = layoutPlatforms(both.graph, [], both.stretchParticipantIds);
  const [short, tall] = f.catalog
    .slice(0, 2)
    .map((p) => unequal.layout.nodes.find((n) => n.node.id === p.id)!);
  expect(short.box.height / tall.box.height).toBeCloseTo(52 / 62);
  expect(compiled.stretchParticipantIds).toEqual([f.catalog[1].id]);
});

it("gives each horizontal stretch participant a full-width row in author order", () => {
  const f = fixture();
  f.scenario.boundaries[1].orientation = "horizontal";
  f.scenario.boundaries.push({
    ...f.scenario.boundaries[0],
    id: "extra",
    name: "Additional column",
    order: 2,
  });
  f.scenario.participantPlacements[1].boundaryId = "extra";
  f.stretch(2, 4);
  const result = f.render();
  const lane = result.atlas.lanes.right;
  const cards = f.catalog.slice(2).map((p) => result.atlas.nodes[p.id]);
  expect(cards[0].width).toBe(lane.width - LANE_PADDING_X * 2);
  expect(cards[2].width).toBe(cards[0].width);
  expect(cards[1].width).toBeLessThan(cards[0].width);
  expect(cards[2].y).toBeGreaterThan(cards[1].y);
  for (let index = 1; index < cards.length; index++)
    expect(cards[index].y).toBeGreaterThan(cards[index - 1].y);
  for (const card of cards)
    expect(card.y + card.height).toBeLessThan(lane.y + lane.height);
});

it("stacks full-width participants when all boundaries are horizontal", () => {
  const f = fixture();
  f.scenario.boundaries.forEach((b) => {
    b.orientation = "horizontal";
  });
  f.stretch(0, 1, 2, 3, 4, 5);
  const result = f.render();
  for (const boundary of f.scenario.boundaries) {
    const lane = result.atlas.lanes[boundary.id];
    const cards = f.scenario.participantPlacements
      .filter((p) => p.boundaryId === boundary.id)
      .map((p) => result.atlas.nodes[p.participantId]);
    cards.forEach((card, index) => {
      expect(card.width).toBe(lane.width - LANE_PADDING_X * 2);
      if (index)
        expect(card.y).toBeGreaterThan(
          cards[index - 1].y + cards[index - 1].height,
        );
    });
  }
});

it("keeps routes outside tall and wide participants and preserves animated exports", () => {
  const f = fixture();
  f.scenario.boundaries.push({
    ...f.scenario.boundaries[0],
    id: "platform",
    name: "Shared services",
    orientation: "horizontal",
    order: 2,
  });
  f.scenario.participantPlacements[5].boundaryId = "platform";
  f.stretch(0, 5);
  const connections = [
    [0, 3],
    [2, 5],
    [5, 4],
    [3, 0],
    [5, 5],
    [0, 1],
    [1, 5],
  ];
  f.scenario.interactions = connections.map(([from, to]) => ({
    ...newInteraction("current"),
    fromParticipantId: f.catalog[from].id,
    toParticipantId: f.catalog[to].id,
    action: "Send",
    pattern: from === to ? "self-action" : "asynchronous message",
    draft: false,
  }));
  const result = f.compile();
  const { layout, routed } = layoutPlatforms(
    result.graph,
    result.horizontalBoundaryIds,
    result.stretchParticipantIds,
  );
  expect(routed).toHaveLength(connections.length);
  for (const route of routed) {
    let previous = route.curve.from;
    for (const segment of route.curve.segments) {
      for (let index = 1; index < 50; index++) {
        const t = index / 50;
        const point = {
          x: previous.x + (segment.to.x - previous.x) * t,
          y: previous.y + (segment.to.y - previous.y) * t,
        };
        for (const { box, node } of layout.nodes) {
          expect(
            point.x > box.x + 0.01 &&
              point.x < box.x + box.width - 0.01 &&
              point.y > box.y + 0.01 &&
              point.y < box.y + box.height - 0.01,
            `Route crosses ${node.label}`,
          ).toBe(false);
        }
      }
      previous = segment.to;
    }
  }
  expect(f.render().svg).toContain("data-studio-interaction");
  expect(scenarioDiagramVariants(f.scenario, f.catalog, "light")[0].svg).toBe(
    f.render().svg,
  );
  expect(
    renderPreview(
      result.graph,
      "data-flow",
      "light",
      result.horizontalBoundaryIds,
      result.stretchParticipantIds,
    ),
  ).toEqual(renderPreview(result.graph, "data-flow", "light"));
  const saved = WorkspaceSchema.parse({
    id: "w",
    name: "Example",
    version: 1,
    scenarios: [f.scenario],
    participants: f.catalog,
  });
  expect(
    saved.scenarios[0].participantPlacements[5].displayHints?.stretchToFill,
  ).toBe(true);
});

it.each(["current", "target", "transition"] as const)(
  "renders stretch hints with the seeded cyclic flow in %s",
  (state) => {
    const w = seedWorkspace();
    const scenario = w.scenarios[0];
    for (const horizontal of [false, true]) {
      scenario.boundaries[1].orientation = horizontal
        ? "horizontal"
        : "vertical";
      for (const mask of [1, 3, 12, 21, 63]) {
        scenario.participantPlacements.forEach((p, index) => {
          p.displayHints = { stretchToFill: Boolean(mask & (1 << index)) };
        });
        const compiled = compileScenario(scenario, w.participants, state);
        if (!compiled.ok) throw Error(compiled.messages.join());
        const rendered = renderPreview(
          compiled.graph,
          "architecture",
          "dark",
          compiled.horizontalBoundaryIds,
          compiled.stretchParticipantIds,
        )!;
        expect(Object.keys(rendered.atlas.nodes)).toHaveLength(
          compiled.graph.nodes.length,
        );
        expect(Object.keys(rendered.atlas.edges)).toHaveLength(
          compiled.graph.edges.length,
        );
        expect(rendered.svg).not.toContain("NaN");
      }
    }
  },
);
