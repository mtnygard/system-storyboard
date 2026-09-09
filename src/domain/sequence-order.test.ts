import { expect, it } from "vitest";
import { sequenceParticipantOrder } from "./sequence-order";
import type { Interaction } from "./model";

const message = (
  from: string,
  to: string,
  pattern: Interaction["pattern"] = "synchronous request",
) => ({
  fromParticipantId: from,
  toParticipantId: to,
  pattern,
});
const forward = (order: string[], interactions: ReturnType<typeof message>[]) =>
  interactions.filter(
    (i) =>
      order.indexOf(i.fromParticipantId) < order.indexOf(i.toParticipantId),
  ).length;

it("orders a call chain across boundaries and leaves unused participants at the end", () => {
  const ids = ["portal", "service", "database", "backend", "events", "monitor"];
  const calls = [
    message("portal", "backend"),
    message("backend", "service"),
    message("service", "database"),
  ];
  expect(sequenceParticipantOrder(ids, calls)).toEqual([
    "portal",
    "backend",
    "service",
    "database",
    "events",
    "monitor",
  ]);
  expect(ids).toEqual([
    "portal",
    "service",
    "database",
    "backend",
    "events",
    "monitor",
  ]);
});
it("favors requests over replies when both orders have the same number of forward arrows", () => {
  const calls = [
    message("b", "a", "return"),
    message("a", "b"),
    message("c", "b", "return"),
    message("b", "c"),
  ];
  expect(sequenceParticipantOrder(["c", "b", "a"], calls)).toEqual([
    "a",
    "b",
    "c",
  ]);
});
it("counts every interaction row and finds a majority direction in a cycle", () => {
  const calls = [
    message("a", "b"),
    message("b", "c"),
    message("c", "a"),
    message("c", "a"),
    message("c", "a"),
  ];
  const order = sequenceParticipantOrder(["a", "b", "c"], calls);
  expect(forward(order, calls)).toBe(4);
});
it("resolves ties by story order, preserves inactive order and handles self calls", () => {
  expect(
    sequenceParticipantOrder(
      ["unused2", "c", "a", "unused1", "b"],
      [message("b", "b", "self-action"), message("a", "c")],
    ),
  ).toEqual(["b", "a", "c", "unused2", "unused1"]);
  expect(sequenceParticipantOrder(["b", "a"], [])).toEqual(["b", "a"]);
  expect(
    sequenceParticipantOrder(["b", "a"], [message("unknown", "missing")]),
  ).toEqual(["b", "a"]);
});
it("matches exhaustive optima on directed graphs with cycles and competing branches", () => {
  function permutations(ids: string[]): string[][] {
    if (!ids.length) return [[]];
    return ids.flatMap((id) =>
      permutations(ids.filter((other) => other !== id)).map((rest) => [
        id,
        ...rest,
      ]),
    );
  }
  const ids = ["a", "b", "c", "d"];
  const possible = ids.flatMap((a) =>
    ids.filter((b) => a !== b).map((b) => message(a, b)),
  );
  const orders = permutations(ids);
  for (const mask of [27, 123, 571, 1035, 2047, 3405, 4095]) {
    const calls = possible.filter((_, index) => mask & (1 << index));
    const actual = forward(sequenceParticipantOrder(ids, calls), calls);
    expect(actual).toBe(
      Math.max(...orders.map((order) => forward(order, calls))),
    );
  }
});
it("handles the supported limit and safely defers oversized flows to validation", () => {
  for (const count of [12, 13, 256]) {
    const ids = Array.from({ length: count }, (_, i) => `p${i}`);
    const calls = ids.slice(1).map((id, index) => message(ids[index], id));
    expect(sequenceParticipantOrder([...ids].reverse(), calls)).toEqual(ids);
  }
});
