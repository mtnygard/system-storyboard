import { expect, it } from "vitest";
import { seedWorkspace } from "./seed";
import { ScenarioSchema } from "./model";
import {
  effectiveInteraction,
  editInteraction,
  resetOverride,
} from "./interaction-overrides";
import { compileScenario, renderPreview } from "../adapter/compiler";
it("inherits untouched fields, preserves explicit equal/empty/false overrides, and resets", () => {
  const i = seedWorkspace().scenarios[0].interactions[0];
  const overridden = editInteraction(
    i,
    { technology: i.technology, payload: "", animated: false },
    "target",
  );
  const changed = editInteraction(
    overridden,
    {
      technology: "new current",
      payload: "current payload",
      action: "Renamed",
    },
    "current",
  );
  expect(effectiveInteraction(changed, "target")).toMatchObject({
    technology: i.technology,
    payload: "",
    animated: false,
    action: "Renamed",
  });
  expect(
    effectiveInteraction(resetOverride(changed, "technology"), "target")
      .technology,
  ).toBe("new current");
  expect(i.targetOverrides).toBeUndefined();
});
it("persists overrides and renders distinct current, target, and transition values", () => {
  const w = seedWorkspace();
  const s = w.scenarios[0];
  s.interactions[0] = editInteraction(
    s.interactions[0],
    { action: "Target-only action" },
    "target",
  );
  const loaded = ScenarioSchema.parse(JSON.parse(JSON.stringify(s)));
  for (const state of ["current", "target", "transition"] as const) {
    const c = compileScenario(loaded, w.participants, state);
    expect(c.ok).toBe(true);
    if (!c.ok) throw Error(c.messages.join());
    const svg = renderPreview(c.graph, "architecture")!.svg;
    expect(svg.includes("Target-only action")).toBe(state !== "current");
    expect(svg.includes("Submit order")).toBe(state !== "target");
  }
});
