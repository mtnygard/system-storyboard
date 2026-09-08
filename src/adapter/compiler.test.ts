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
import { newInteraction, reorder, type State } from "../domain/model";
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
