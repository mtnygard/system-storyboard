import { describe, it, expect } from "vitest";
import { safeParseGraphDoc } from "@coldtea/pr-lens-schema";
import {
  compileScenario,
  delta,
  messageKind,
  messageFor,
  renderPreview,
  translateValidation,
} from "./compiler";
import { seedWorkspace } from "../domain/seed";
import {
  newInteraction,
  newParticipant,
  newPlacement,
  newScenario,
  reorder,
  type State,
} from "../domain/model";
import { createHash } from "./browser-crypto";
describe("Studio compiler", () => {
  it.each([
    [false, true, false, "added"],
    [true, false, false, "removed"],
    [true, true, true, "modified"],
    [true, true, false, "unchanged"],
  ] as const)(
    "maps presence %s %s %s to %s",
    (current, target, changed, expected) =>
      expect(delta({ current, target, changed }, "transition")).toBe(expected),
  );
  it("uses unchanged for single-state presence unless explicitly changed", () => {
    expect(
      delta({ current: false, target: true, changed: false }, "target"),
    ).toBe("unchanged");
    expect(
      delta({ current: true, target: true, changed: true }, "current"),
    ).toBe("modified");
  });
  it.each([
    ["synchronous request", "sync"],
    ["asynchronous message", "async"],
    ["return", "return"],
    ["self-action", "self"],
    ["data access", "sync"],
    ["dependency", "sync"],
    ["other", "sync"],
  ] as const)("maps %s to %s", (pattern, expected) =>
    expect(messageKind({ ...newInteraction(), pattern })).toBe(expected),
  );
  it("retains protocol, payload, repeat, traffic, and operational note", () => {
    const i = {
      ...newInteraction(),
      action: "Publish",
      technology: "AMQP",
      payload: "Order",
      frequency: "4",
      resilience: "Retry safely",
      animated: false,
    };
    expect(messageFor(i, "transition")).toMatchObject({
      label: "Publish · AMQP · Order",
      repeat: 4,
      note: "Retry safely",
      animated: false,
    });
  });
  it.each(["current", "target", "transition"] as State[])(
    "validates and renders both seeded views in %s",
    (state) => {
      const w = seedWorkspace();
      const result = compileScenario(w.scenarios[0], w.participants, state);
      expect(result.ok, result.ok ? "" : result.messages.join("\n")).toBe(true);
      if (!result.ok) return;
      expect(safeParseGraphDoc(result.graph).ok).toBe(true);
      for (const lens of ["architecture", "data-flow"] as const) {
        for (const theme of ["light", "dark"] as const) {
          const r = renderPreview(result.graph, lens, theme)!;
          expect(r.svg).toContain("<svg");
          expect(r.width).toBeGreaterThan(100);
          expect(Object.keys(r.atlas.nodes).length).toBeGreaterThan(1);
        }
      }
      const ids = result.graph.nodes.map((n) => n.id);
      if (state === "current") {
        expect(ids).toContain("p-esb");
        expect(ids).not.toContain("p-events");
      }
      if (state === "target") {
        expect(ids).not.toContain("p-esb");
        expect(ids).toContain("p-events");
      }
    },
  );
  it("keeps IDs and layout stable when names change", () => {
    const w = seedWorkspace();
    const a = compileScenario(w.scenarios[0], w.participants, "transition");
    const b = compileScenario(
      { ...w.scenarios[0], name: "Another title" },
      w.participants.map((p) => ({ ...p, name: "Renamed " + p.name })),
      "transition",
    );
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.graph.nodes.map((n) => n.id)).toEqual(
        b.graph.nodes.map((n) => n.id),
      );
      expect(a.graph.edges.map((n) => n.id)).toEqual(
        b.graph.edges.map((n) => n.id),
      );
      expect(a.graph.layout).toEqual(b.graph.layout);
    }
  });
  it("stacks participants within each boundary regardless of creation order", () => {
    const scenario = newScenario();
    const frontend = scenario.boundaries[0].id;
    scenario.boundaries.push(
      {
        ...scenario.boundaries[0],
        id: "application",
        name: "Application",
        order: 1,
      },
      { ...scenario.boundaries[0], id: "data", name: "Data", order: 2 },
    );
    const catalog = [
      "Customer Portal",
      "Order Service",
      "Inventory Service",
      "Database",
      "Portal Backend",
    ].map(newParticipant);
    scenario.participantPlacements = catalog.map((p, index) =>
      newPlacement(
        p.id,
        [frontend, "application", "data", "data", frontend][index],
        "current",
      ),
    );
    const render = () => {
      const result = compileScenario(scenario, catalog, "current");
      if (!result.ok) throw Error(result.messages.join());
      return renderPreview(result.graph, "architecture")!.atlas.nodes;
    };
    const before = render();
    expect(before[catalog[0].id].y).toBe(before[catalog[1].id].y);
    expect(before[catalog[0].id].y).toBe(before[catalog[2].id].y);
    expect(before[catalog[4].id].y).toBe(before[catalog[3].id].y);
    expect(before[catalog[4].id].y).toBeGreaterThan(before[catalog[0].id].y);
    expect(before[catalog[4].id].x).toBe(before[catalog[0].id].x);

    // Swap the two frontend placements, preserving every other boundary.
    scenario.participantPlacements = reorder(
      scenario.participantPlacements,
      0,
      4,
    );
    const after = render();
    expect(after[catalog[4].id]).toEqual(before[catalog[0].id]);
    expect(after[catalog[0].id]).toEqual(before[catalog[4].id]);
    for (const index of [1, 2, 3]) {
      expect(after[catalog[index].id]).toEqual(before[catalog[index].id]);
    }

    // A participant hidden in this view must not reserve a row.
    scenario.participantPlacements[0].current = false;
    const filtered = render();
    expect(filtered[catalog[4].id]).toBeUndefined();
    expect(filtered[catalog[0].id].y).toBe(filtered[catalog[1].id].y);
  });
  it("introduces vertical flow spacing when cross-boundary interactions are added", () => {
    const scenario = newScenario();
    const firstBoundary = scenario.boundaries[0];
    scenario.boundaries = ["Frontend", "Application", "Data"].map(
      (name, order) => ({
        ...firstBoundary,
        id: name,
        name,
        order,
      }),
    );
    const catalog = [
      "Portal",
      "Order Service",
      "Inventory Service",
      "Portal Backend",
    ].map(newParticipant);
    scenario.participantPlacements = catalog.map((p, index) =>
      newPlacement(
        p.id,
        ["Frontend", "Application", "Data", "Frontend"][index],
        "current",
      ),
    );
    const render = () => {
      const result = compileScenario(scenario, catalog, "current");
      if (!result.ok) throw Error(result.messages.join());
      return renderPreview(result.graph, "architecture")!;
    };
    const compact = render();
    expect(compact.atlas.nodes[catalog[0].id].y).toBe(
      compact.atlas.nodes[catalog[2].id].y,
    );
    // Portal -> Portal Backend -> Order Service -> Inventory Service.
    const flow = [0, 3, 1, 2];
    scenario.interactions = flow.slice(1).map((receiver, index) => ({
      ...newInteraction("current"),
      fromParticipantId: catalog[flow[index]].id,
      toParticipantId: catalog[receiver].id,
      action: "Request data",
      pattern: "synchronous request",
      draft: false,
    }));
    const connected = render();
    for (let index = 1; index < flow.length; index++) {
      const sender = connected.atlas.nodes[catalog[flow[index - 1]].id];
      const receiver = connected.atlas.nodes[catalog[flow[index]].id];
      expect(receiver.y).toBeGreaterThan(sender.y + sender.height);
    }
    expect(connected.height).toBeGreaterThan(compact.height);
    expect(Object.keys(connected.atlas.edges)).toHaveLength(3);
    scenario.interactions = [];
    expect(render().atlas.nodes).toEqual(compact.atlas.nodes);
  });
  it("orders sequence columns from the displayed state's flow without moving architecture participants or steps", () => {
    const scenario = newScenario("Automatic sequence order");
    scenario.mode = "transition";
    const catalog = ["Portal", "Worker", "Ledger", "Gateway", "Metrics"].map(
      newParticipant,
    );
    scenario.participantPlacements = catalog.map((p) =>
      newPlacement(p.id, scenario.boundaries[0].id, "transition"),
    );
    const current = [
      [0, 3],
      [3, 1],
      [1, 2],
    ];
    const target = [
      [2, 1],
      [1, 3],
      [3, 0],
    ];
    scenario.interactions = current.map(([from, to], index) => ({
      ...newInteraction("transition"),
      fromParticipantId: catalog[from].id,
      toParticipantId: catalog[to].id,
      action: `Step ${index + 1}`,
      pattern: "synchronous request",
      draft: false,
      targetOverrides: {
        fromParticipantId: catalog[target[index][0]].id,
        toParticipantId: catalog[target[index][1]].id,
      },
    }));
    scenario.interactions.push({
      ...newInteraction("transition"),
      fromParticipantId: catalog[4].id,
      toParticipantId: catalog[0].id,
      action: "Unfinished",
    });
    for (const state of ["current", "target"] as const) {
      const result = compileScenario(scenario, catalog, state);
      if (!result.ok) throw Error(result.messages.join());
      const graph = result.graph;
      const expected = (
        state === "current" ? [0, 3, 1, 2, 4] : [2, 1, 3, 0, 4]
      ).map((index) => catalog[index].id);
      expect(graph.flows[0].participants.map((p) => p.node)).toEqual(expected);
      expect(graph.nodes.map((p) => p.id)).toEqual(catalog.map((p) => p.id));
      expect(graph.flows[0].messages.map((m) => m.id)).toEqual(
        scenario.interactions.slice(0, 3).map((i) => `message-${i.id}`),
      );
      expect(result.omitted).toHaveLength(1);
      const rendered = renderPreview(graph, "data-flow")!;
      const columns = expected.map((id) => rendered.atlas.nodes[id].x);
      expect(columns).toEqual([...columns].sort((a, b) => a - b));
      const originalOrder = {
        ...graph,
        flows: [
          {
            ...graph.flows[0],
            participants: catalog.map((p) => ({ node: p.id })),
          },
        ],
      };
      expect(renderPreview(graph, "architecture")!.svg).toBe(
        renderPreview(originalOrder, "architecture")!.svg,
      );
    }
  });
  it("reorders flow messages and their animation order", () => {
    const w = seedWorkspace();
    const s = w.scenarios[0];
    const a = compileScenario(
      { ...s, interactions: reorder(s.interactions, 0, 1) },
      w.participants,
      "transition",
    );
    if (!a.ok) throw Error(a.messages.join());
    expect(a.graph.flows[0].messages[0].id).toBe("message-i-legacy");
    expect(a.graph.flows[0].messages[1].id).toBe("message-i-submit");
  });
  it("rejects removed endpoints with helpful language", () => {
    const w = seedWorkspace();
    w.scenarios[0].interactions[0].toParticipantId = "missing";
    const r = compileScenario(w.scenarios[0], w.participants, "transition");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.messages.join()).toContain("Choose a participant");
      expect(r.messages.join()).not.toMatch(/Zod|nodes\[|edges\[/);
    }
  });
  it("translates schema failures without leaking internals", () => {
    const w = seedWorkspace();
    expect(
      translateValidation(w.scenarios[0], "flows[0].messages[0].from"),
    ).toContain("Submit order");
    expect(
      translateValidation(w.scenarios[0], "walkthrough.steps[0]"),
    ).toContain("Complete its headings");
  });
  it("escapes author text in standalone SVGs", () => {
    const w = seedWorkspace();
    w.participants[0].name = "<script>alert(1)</script>";
    const r = compileScenario(w.scenarios[0], w.participants, "transition");
    if (!r.ok) throw Error(r.messages.join());
    expect(renderPreview(r.graph, "architecture")!.svg).not.toContain(
      "<script>",
    );
  });
  it("provides browser-compatible SHA-256", () =>
    expect(createHash("sha256").update("abc").digest("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ));
});
