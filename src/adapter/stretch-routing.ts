import type { Box } from "@coldtea/pr-lens-renderer";
import type { PlacedNode, RoutedEdge } from "./renderer-internals";

type Point = { x: number; y: number };
const CLEARANCE = 16;
const EPSILON = 0.001;

/** A small A* queue; the heuristic is Manhattan distance and turns have a cost. */
class RouteQueue {
  private items: { state: number; score: number }[] = [];
  push(state: number, score: number) {
    let index = this.items.length;
    this.items.push({ state, score });
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].score <= score) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = { state, score };
  }
  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (!last || !this.items.length) return first;
    let index = 0;
    while (index * 2 + 1 < this.items.length) {
      let child = index * 2 + 1;
      if (
        child + 1 < this.items.length &&
        this.items[child + 1].score < this.items[child].score
      )
        child++;
      if (last.score <= this.items[child].score) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return first;
  }
}

function outside(point: Point, box: Box): Point {
  const sides = [
    {
      distance: Math.abs(point.x - box.x),
      point: { x: box.x - CLEARANCE, y: point.y },
    },
    {
      distance: Math.abs(point.x - box.x - box.width),
      point: { x: box.x + box.width + CLEARANCE, y: point.y },
    },
    {
      distance: Math.abs(point.y - box.y),
      point: { x: point.x, y: box.y - CLEARANCE },
    },
    {
      distance: Math.abs(point.y - box.y - box.height),
      point: { x: point.x, y: box.y + box.height + CLEARANCE },
    },
  ];
  return sides.sort((a, b) => a.distance - b.distance)[0].point;
}

function simplify(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    const before = result.at(-2);
    if (
      before &&
      previous &&
      ((before.x === previous.x && previous.x === point.x) ||
        (before.y === previous.y && previous.y === point.y))
    )
      result.pop();
    result.push(point);
  }
  return result;
}

/** Route on obstacle edges, not row centers: stretched cards can span many rows. */
function findPath(start: Point, end: Point, obstacles: Box[]): Point[] {
  const xs = [
    ...new Set([
      start.x,
      end.x,
      ...obstacles.flatMap((b) => [b.x, b.x + b.width]),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      start.y,
      end.y,
      ...obstacles.flatMap((b) => [b.y, b.y + b.height]),
    ]),
  ].sort((a, b) => a - b);
  const point = (vertex: number) => ({
    x: xs[vertex % xs.length],
    y: ys[Math.floor(vertex / xs.length)],
  });
  const vertex = (p: Point) => ys.indexOf(p.y) * xs.length + xs.indexOf(p.x);
  const startVertex = vertex(start),
    endVertex = vertex(end);
  // Direction is part of the state so the cheapest arrival includes its turn cost.
  const distance = new Float64Array(xs.length * ys.length * 3).fill(Infinity);
  const parent = new Int32Array(distance.length).fill(-1);
  const queue = new RouteQueue();
  const initial = startVertex * 3;
  distance[initial] = 0;
  queue.push(initial, Math.abs(start.x - end.x) + Math.abs(start.y - end.y));
  const blocked = new Map<string, boolean>();
  function clear(a: number, b: number) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (blocked.has(key)) return !blocked.get(key);
    const p = point(a),
      q = point(b);
    const intersects = obstacles.some((box) =>
      p.x === q.x
        ? p.x > box.x + EPSILON &&
          p.x < box.x + box.width - EPSILON &&
          Math.max(p.y, q.y) > box.y + EPSILON &&
          Math.min(p.y, q.y) < box.y + box.height - EPSILON
        : p.y > box.y + EPSILON &&
          p.y < box.y + box.height - EPSILON &&
          Math.max(p.x, q.x) > box.x + EPSILON &&
          Math.min(p.x, q.x) < box.x + box.width - EPSILON,
    );
    blocked.set(key, intersects);
    return !intersects;
  }
  let item;
  while ((item = queue.pop())) {
    const current = Math.floor(item.state / 3),
      direction = item.state % 3;
    const p = point(current);
    if (
      item.score >
      distance[item.state] +
        Math.abs(p.x - end.x) +
        Math.abs(p.y - end.y) +
        EPSILON
    )
      continue;
    if (current === endVertex) {
      const path = [];
      for (let state = item.state; state !== -1; state = parent[state])
        path.push(point(Math.floor(state / 3)));
      return path.reverse();
    }
    const x = current % xs.length,
      y = Math.floor(current / xs.length);
    const neighbors = [
      ...(x > 0 ? [[current - 1, 1]] : []),
      ...(x + 1 < xs.length ? [[current + 1, 1]] : []),
      ...(y > 0 ? [[current - xs.length, 2]] : []),
      ...(y + 1 < ys.length ? [[current + xs.length, 2]] : []),
    ];
    for (const [next, nextDirection] of neighbors) {
      if (!clear(current, next)) continue;
      const q = point(next);
      const cost =
        distance[item.state] +
        Math.abs(p.x - q.x) +
        Math.abs(p.y - q.y) +
        (direction && direction !== nextDirection ? 24 : 0);
      const state = next * 3 + nextDirection;
      if (cost >= distance[state]) continue;
      distance[state] = cost;
      parent[state] = item.state;
      queue.push(state, cost + Math.abs(q.x - end.x) + Math.abs(q.y - end.y));
    }
  }
  throw new Error("No clear route between stretched participants");
}

export function routeAroundParticipants(
  routes: RoutedEdge[],
  nodes: PlacedNode[],
): RoutedEdge[] {
  const boxes = new Map(nodes.map((p) => [p.node.id, p.box]));
  const obstacles = nodes.map(({ box }) => ({
    x: box.x - CLEARANCE,
    y: box.y - CLEARANCE,
    width: box.width + CLEARANCE * 2,
    height: box.height + CLEARANCE * 2,
  }));
  return routes.map((route) => {
    const from = route.curve.from;
    const to = route.curve.segments.at(-1)!.to;
    const start = outside(from, boxes.get(route.edge.from)!);
    const end = outside(to, boxes.get(route.edge.to)!);
    const points = simplify([from, ...findPath(start, end, obstacles), to]);
    const segments = points
      .slice(1)
      .map((point) => ({ kind: "line" as const, to: point }));
    const runs = points.slice(1).map((point, index) => ({
      length:
        Math.abs(point.x - points[index].x) +
        Math.abs(point.y - points[index].y),
      middle: {
        x: (point.x + points[index].x) / 2,
        y: (point.y + points[index].y) / 2,
      },
    }));
    return {
      ...route,
      curve: { from, segments },
      path: points
        .map((p, index) => `${index ? "L" : "M"} ${p.x} ${p.y}`)
        .join(" "),
      labelAnchor: runs.sort((a, b) => b.length - a.length)[0]?.middle,
    };
  });
}
