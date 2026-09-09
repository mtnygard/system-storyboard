import { describe, expect, it } from "vitest";
import { render } from "@coldtea/pr-lens-renderer";
import { seedWorkspace } from "../domain/seed";
import { compileScenario, renderPreview } from "./compiler";
import { reorder, type State } from "../domain/model";

function fixture(state: State = "transition") {
  const w = seedWorkspace();
  const compiled = compileScenario(w.scenarios[0], w.participants, state);
  if (!compiled.ok) throw Error(compiled.messages.join());
  return compiled.graph;
}
function pulses(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return [...doc.querySelectorAll("circle[data-studio-slot]")].sort(
    (a, b) =>
      Number(a.getAttribute("data-studio-slot")) -
      Number(b.getAttribute("data-studio-slot")),
  );
}
describe("architecture story clock", () => {
  it.each(["current", "target", "transition"] as State[])(
    "gives %s interactions exclusive, consecutive time slots in both exports",
    (state) => {
      const graph = fixture(state);
      for (const theme of ["light", "dark"] as const) {
        const output = renderPreview(graph, "architecture", theme)!;
        const dots = pulses(output.svg);
        expect(
          dots.map((dot) => dot.getAttribute("data-studio-interaction")),
        ).toEqual(graph.edges.map((edge) => edge.id));
        const durations = new Set(
          dots.map((dot) =>
            dot.querySelector("animateMotion")!.getAttribute("dur"),
          ),
        );
        expect(durations.size).toBe(1);
        dots.forEach((dot, index) => {
          const times = dot
            .querySelector("animateMotion")!
            .getAttribute("keyTimes")!
            .split(";")
            .map(Number);
          expect(times[1]).toBeCloseTo(index / dots.length, 7);
          expect(times[2]).toBeCloseTo((index + 1) / dots.length, 7);
          expect(dot.getAttribute("opacity")).toBe("0");
          const visibility = dot.querySelector("animate")!;
          expect(visibility.getAttribute("values")).toBe("0;0;1;1;0;0");
          expect(visibility.getAttribute("dur")).toBe([...durations][0]);
        });
        expect(output.atlas).toEqual(
          render(graph, { lens: "architecture", theme }).atlas,
        );
      }
    },
  );
  it("changes the first crossing when rows are reordered", () => {
    const w = seedWorkspace();
    const scenario = w.scenarios[0];
    scenario.interactions = reorder(scenario.interactions, 0, 1);
    const compiled = compileScenario(scenario, w.participants, "transition");
    if (!compiled.ok) throw Error(compiled.messages.join());
    expect(
      pulses(
        renderPreview(compiled.graph, "architecture")!.svg,
      )[0].getAttribute("data-studio-interaction"),
    ).toBe("edge-i-legacy");
  });
  it("omits disabled traffic and gives repeated interactions consecutive crossings", () => {
    const graph = fixture();
    graph.edges[0].animated = false;
    graph.flows[0].messages[1].repeat = 3;
    const dots = pulses(renderPreview(graph, "architecture")!.svg);
    expect(
      dots.map((dot) => dot.getAttribute("data-studio-interaction")),
    ).toEqual([
      graph.edges[1].id,
      graph.edges[1].id,
      ...graph.edges.slice(1).map((e) => e.id),
    ]);
  });
  it("keeps fully static architecture and sequence output untouched", () => {
    const graph = fixture();
    graph.edges.forEach((e) => (e.animated = false));
    graph.flows.forEach((flow) =>
      flow.messages.forEach((message) => (message.animated = false)),
    );
    expect(renderPreview(graph, "architecture")!.svg).toBe(
      render(graph, { lens: "architecture", theme: "light" }).svg,
    );
    expect(renderPreview(graph, "data-flow")!.svg).toBe(
      render(graph, { lens: "data-flow", theme: "light" }).svg,
    );
  });
});
