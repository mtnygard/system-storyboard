import { describe, expect, it } from "vitest";
import { seedWorkspace } from "../domain/seed";
import { compileScenario, renderPreview } from "./compiler";

function fixture() {
  const workspace = seedWorkspace();
  const result = compileScenario(
    workspace.scenarios[0],
    workspace.participants,
    "transition",
  );
  if (!result.ok) throw Error(result.messages.join());
  return result.graph;
}

describe.each(["architecture", "data-flow"] as const)(
  "%s traffic highlights",
  (lens) => {
    it.each(["light", "dark"] as const)(
      "highlights the route and endpoints on the pulse clock in %s",
      (theme) => {
        const graph = fixture();
        graph.edges[0].animated = false;
        graph.flows[0].messages[0].animated = false;
        graph.flows[0].messages[1].repeat = 3;
        const rendered = renderPreview(graph, lens, theme)!;
        const doc = new DOMParser().parseFromString(
          rendered.svg,
          "image/svg+xml",
        );
        expect(doc.querySelector("parsererror")).toBeNull();
        const groups = [...doc.querySelectorAll("[data-studio-traffic]")];
        const interactions =
          lens === "architecture" ? graph.edges : graph.flows[0].messages;
        const expected = interactions
          .slice(1)
          .flatMap((interaction, index) =>
            Array(index === 0 ? 3 : 1).fill(interaction),
          );
        expect(groups).toHaveLength(expected.length);
        groups.forEach((group, index) => {
          const highlight = group.querySelector("[data-studio-highlight]")!;
          expect(highlight.getAttribute("stroke")).toBe(
            ["async", "event"].includes(expected[index].kind)
              ? theme === "dark"
                ? "#c4b5fd"
                : "#7c3aed"
              : theme === "dark"
                ? "#ffd166"
                : "#b66a00",
          );
          expect(highlight.querySelector("path")!.getAttribute("stroke")).toBe(
            highlight.getAttribute("stroke"),
          );
          expect(highlight.querySelector("animate")!.outerHTML).toBe(
            group.querySelector("circle > animate")!.outerHTML,
          );
          expect(highlight.querySelector("path")!.getAttribute("d")).toBe(
            group.querySelector("animateMotion")!.getAttribute("path"),
          );
          const shift = rendered.svg.match(
            /<g transform="translate\(([-\d.]+),([-\d.]+)\)"/,
          );
          const boxes = [...highlight.querySelectorAll("rect")];
          const endpoints = [
            ...new Set([expected[index].from, expected[index].to]),
          ];
          expect(boxes).toHaveLength(endpoints.length);
          boxes.forEach((rect, endpoint) => {
            const box = rendered.atlas.nodes[endpoints[endpoint]];
            expect(
              Number(rect.getAttribute("x")) + Number(shift?.[1] ?? 0),
            ).toBeCloseTo(box.x - 3);
            expect(
              Number(rect.getAttribute("y")) + Number(shift?.[2] ?? 0),
            ).toBeCloseTo(box.y - 3);
            expect(Number(rect.getAttribute("width"))).toBe(box.width + 6);
          });
        });
      },
    );
  },
);
