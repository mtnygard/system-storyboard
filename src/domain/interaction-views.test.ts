import { expect, it } from "vitest";
import { seedWorkspace } from "./seed";
import {
  populateTarget,
  interactionsFor,
  moveVisible,
} from "./interaction-views";
it("initializes target with shared identities and placements without overwriting an existing target", () => {
  const s = seedWorkspace().scenarios[0];
  s.interactions = s.interactions
    .filter((i) => i.current)
    .map((i) => ({ ...i, target: false }));
  s.participantPlacements = s.participantPlacements.map((p) => ({
    ...p,
    target: false,
  }));
  const next = populateTarget(s);
  expect(next.interactions.map((i) => i.id)).toEqual(
    s.interactions.map((i) => i.id),
  );
  expect(next.interactions.every((i) => i.current && i.target)).toBe(true);
  expect(
    next.participantPlacements.filter((p) => p.current).every((p) => p.target),
  ).toBe(true);
  expect(s.interactions.every((i) => !i.target)).toBe(true);
  expect(populateTarget(next)).toBe(next);
});
it("reorders filtered interactions without losing hidden rows", () => {
  const s = seedWorkspace().scenarios[0];
  const visible = interactionsFor(s, "target");
  const result = moveVisible(s, visible, 0, 1);
  expect(
    result
      .filter((i) => i.target)
      .slice(0, 2)
      .map((i) => i.id),
  ).toEqual([visible[1].id, visible[0].id]);
  s.interactions.forEach((i, index) => {
    if (!i.target) expect(result[index]).toBe(i);
  });
  expect(new Set(result.map((i) => i.id)).size).toBe(s.interactions.length);
});
