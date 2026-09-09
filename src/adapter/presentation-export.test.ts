import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { seedWorkspace } from "../domain/seed";
import { planPresentation } from "./presentation-plan";
import { packagePresentation } from "./presentation-export";
import {
  interpolate,
  splitAnimation,
  staticDiagramSvg,
} from "./presentation-render";

describe("PowerPoint presentation plan", () => {
  it("preserves every authored card in order and both diagram views", () => {
    const workspace = seedWorkspace();
    const scenario = workspace.scenarios[0];
    const plan = planPresentation(
      scenario,
      workspace.participants,
      "transition",
      "dark",
    );
    expect(plan.slides.slice(1).map((slide) => slide.heading)).toEqual(
      scenario.walkthroughSteps.map((step) => step.heading),
    );
    expect(plan.slides.slice(1).map((slide) => slide.focus)).toEqual(
      scenario.walkthroughSteps,
    );
    expect(Object.keys(plan.diagrams)).toEqual(["architecture", "data-flow"]);
    expect(plan.diagrams.architecture?.theme).toBe("dark");
  });
  it("keeps a single authored card even though the HTML compiler requires two", () => {
    const workspace = seedWorkspace();
    const scenario = workspace.scenarios[0];
    scenario.walkthroughSteps = scenario.walkthroughSteps.slice(0, 1);
    expect(
      planPresentation(scenario, workspace.participants, "transition", "light")
        .slides,
    ).toHaveLength(2);
  });
  it("blocks incomplete interactions and invalid cards rather than exporting a partial story", () => {
    const workspace = seedWorkspace();
    const scenario = workspace.scenarios[0];
    scenario.walkthroughSteps[0].heading = "";
    expect(() =>
      planPresentation(scenario, workspace.participants, "transition", "light"),
    ).toThrow(/heading/);
    scenario.walkthroughSteps = [];
    scenario.interactions[0].draft = true;
    scenario.interactions[0].action = "";
    expect(() =>
      planPresentation(scenario, workspace.participants, "transition", "light"),
    ).toThrow(/unfinished/);
  });
  it("does not silently lose focus references missing from the selected state", () => {
    const workspace = seedWorkspace();
    const scenario = workspace.scenarios[0];
    scenario.walkthroughSteps = [
      {
        id: "card",
        heading: "Future system",
        explanation: "A new participant",
        stage: "architecture",
        participantIds: ["p-events"],
        interactionIds: [],
      },
    ];
    expect(() =>
      planPresentation(scenario, workspace.participants, "current", "light"),
    ).toThrow(/unavailable in current/);
    expect(
      planPresentation(scenario, workspace.participants, "target", "light")
        .slides,
    ).toHaveLength(2);
  });
  it("exports available overviews without inventing cards or requiring sequence content", () => {
    const workspace = seedWorkspace();
    const scenario = workspace.scenarios[0];
    scenario.walkthroughSteps = [];
    scenario.interactions = [];
    scenario.participantPlacements = scenario.participantPlacements.slice(0, 1);
    const plan = planPresentation(
      scenario,
      workspace.participants,
      "current",
      "light",
    );
    expect(plan.slides).toHaveLength(1);
    expect(Object.keys(plan.diagrams)).toEqual(["architecture"]);
  });
});

it("preserves holds, motion, and opacity ramps at shared keyframe boundaries", () => {
  expect(interpolate([0, 0.25, 0.5, 1], [0, 0, 1, 1], 0.1)).toBe(0);
  expect(interpolate([0, 0.25, 0.5, 1], [0, 0, 1, 1], 0.375)).toBe(0.5);
  expect(interpolate([0, 0.25, 0.5, 1], [0, 0, 1, 1], 0.75)).toBe(1);
  expect(interpolate([0, 0, 0.1, 0.9, 1, 1], [0, 0, 1, 1, 0, 0], 0)).toBe(0);
  expect(interpolate([0, 0, 0.1, 0.9, 1, 1], [0, 0, 1, 1, 0, 0], 1)).toBe(0);
});

it("keeps static diagrams as vector paths and text with vector focus highlights", () => {
  const workspace = seedWorkspace();
  const scenario = workspace.scenarios[0];
  scenario.interactions.forEach((interaction) => {
    interaction.animated = false;
  });
  const plan = planPresentation(
    scenario,
    workspace.participants,
    "transition",
    "dark",
  );
  const rendered = plan.diagrams.architecture!;
  const frozen = splitAnimation(rendered.svg).svg;
  const svg = staticDiagramSvg(frozen, rendered, {
    id: "focus",
    heading: "Focus",
    explanation: "Details",
    stage: "architecture",
    participantIds: ["p-store"],
    interactionIds: [scenario.interactions[0].id],
  });
  const original = new DOMParser().parseFromString(frozen, "image/svg+xml");
  const result = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(
    result.querySelector("parsererror, image, animateMotion, animate"),
  ).toBeNull();
  expect(
    [...result.querySelectorAll("path")].map((path) => path.getAttribute("d")),
  ).toEqual(
    [...original.querySelectorAll("path")].map((path) =>
      path.getAttribute("d"),
    ),
  );
  expect(
    [...result.querySelectorAll("text")].map((text) => text.textContent),
  ).toEqual(
    [...original.querySelectorAll("text")].map((text) => text.textContent),
  );
  expect(result.querySelectorAll('[data-studio-focus="true"]')).toHaveLength(2);
  const [x, y, w, h] = result.documentElement
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  expect(w / h).toBeCloseTo(1920 / 812);
  expect(x).toBeLessThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(0);
  expect(w).toBeGreaterThanOrEqual(rendered.width);
  expect(h).toBeGreaterThanOrEqual(rendered.height);
  expect(() =>
    staticDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><animateMotion/></svg>',
      rendered,
    ),
  ).toThrow(/animation removed/);
});

it("packages video bytes, poster frames, and editable text without external relationships", async () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const video = new Uint8Array([
    0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50,
  ]);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="812" viewBox="0 0 1920 812"><path d="M0 0 Q100 200 300 0" stroke="black" fill="none"/><text x="20" y="40">Vector diagram</text></svg>';
  const bytes = await packagePresentation(
    { title: "A & B", state: "current", theme: "light" },
    [
      {
        heading: "First <step>",
        explanation: "Explain & focus",
        image: `data:image/svg+xml;base64,${btoa(svg)}`,
      },
      {
        heading: "Motion",
        explanation: "Architecture animation",
        image: png,
        video,
      },
    ],
  );
  const files = unzipSync(new Uint8Array(bytes));
  const slides = Object.keys(files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  expect(slides).toHaveLength(2);
  const firstSlide = new DOMParser().parseFromString(
    strFromU8(files[slides[0]]),
    "application/xml",
  );
  const svgBlip = firstSlide.getElementsByTagNameNS(
    "http://schemas.microsoft.com/office/drawing/2016/SVG/main",
    "svgBlip",
  );
  expect(svgBlip).toHaveLength(1);
  const rels = new DOMParser().parseFromString(
    strFromU8(files["ppt/slides/_rels/slide1.xml.rels"]),
    "application/xml",
  );
  const svgId = svgBlip[0].getAttributeNS(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "embed",
  );
  const svgRel = [...rels.getElementsByTagName("Relationship")].find(
    (rel) => rel.getAttribute("Id") === svgId,
  )!;
  expect(
    strFromU8(files[`ppt/${svgRel.getAttribute("Target")!.slice(3)}`]),
  ).toBe(svg);
  const fallback = firstSlide.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/drawingml/2006/main",
    "blip",
  )[0];
  const fallbackId = fallback.getAttributeNS(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "embed",
  );
  expect(
    [...rels.getElementsByTagName("Relationship")]
      .find((rel) => rel.getAttribute("Id") === fallbackId)!
      .getAttribute("Target"),
  ).toMatch(/\.png$/);
  expect(strFromU8(files[slides[0]])).toContain("First &lt;step&gt;");
  const media = Object.keys(files).filter((name) => name.endsWith(".mp4"));
  expect(media.length).toBeGreaterThan(0);
  for (const name of media) expect(files[name]).toEqual(video);
  const xml = strFromU8(files["ppt/slides/slide2.xml"]);
  expect(xml).toContain("videoFile");
  expect(xml).toContain("media");
  expect(xml).toContain("hlinkClick");
  const presentationNs =
    "http://schemas.openxmlformats.org/presentationml/2006/main";
  for (const slideName of slides) {
    const slide = new DOMParser().parseFromString(
      strFromU8(files[slideName]),
      "application/xml",
    );
    const ids = [...slide.getElementsByTagNameNS(presentationNs, "cNvPr")].map(
      (node) => node.getAttribute("id"),
    );
    expect(
      new Set(ids).size,
      "Every shape, including the movie and poster, needs a unique ID",
    ).toBe(ids.length);
  }
  const movieSlide = new DOMParser().parseFromString(xml, "application/xml");
  const timing = movieSlide.getElementsByTagNameNS(presentationNs, "timing")[0];
  expect(timing.parentElement).toBe(movieSlide.documentElement);
  const clockIds = [
    ...timing.getElementsByTagNameNS(presentationNs, "cTn"),
  ].map((node) => node.getAttribute("id"));
  expect(new Set(clockIds).size).toBe(clockIds.length);
  const playback = timing.getElementsByTagNameNS(presentationNs, "video");
  expect(playback).toHaveLength(1);
  const target = playback[0]
    .getElementsByTagNameNS(presentationNs, "spTgt")[0]
    .getAttribute("spid");
  const movie = [
    ...movieSlide.getElementsByTagNameNS(presentationNs, "pic"),
  ].find(
    (node) =>
      node.getElementsByTagNameNS(
        "http://schemas.openxmlformats.org/drawingml/2006/main",
        "videoFile",
      ).length,
  )!;
  expect(target).toBe(
    movie.getElementsByTagNameNS(presentationNs, "cNvPr")[0].getAttribute("id"),
  );
  expect(
    playback[0]
      .getElementsByTagNameNS(presentationNs, "cond")[0]
      .getAttribute("delay"),
  ).toBe("indefinite");
  expect(strFromU8(files[slides[0]])).not.toContain("p:timing");
  for (const [name, content] of Object.entries(files))
    if (name.endsWith(".rels")) {
      const doc = new DOMParser().parseFromString(
        strFromU8(content),
        "text/xml",
      );
      expect(doc.querySelector('[TargetMode="External"]')).toBeNull();
      const parent = name === "_rels/.rels" ? [] : name.split("/").slice(0, -2);
      for (const relation of doc.querySelectorAll("Relationship")) {
        const parts = [...parent];
        for (const piece of relation.getAttribute("Target")!.split("/")) {
          if (piece === "..") parts.pop();
          else if (piece !== ".") parts.push(piece);
        }
        expect(
          files[parts.join("/")],
          `${name}: ${relation.getAttribute("Target")}`,
        ).toBeDefined();
      }
    }
});

it("extracts traffic highlights for video and removes them from static exports", async () => {
  const { splitAnimation } = await import("./presentation-render");
  // jsdom has no SVG path geometry; extraction only needs the length here.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
  try {
    for (const lens of ["architecture", "data-flow"] as const) {
      const workspace = seedWorkspace();
      const plan = planPresentation(
        workspace.scenarios[0],
        workspace.participants,
        "transition",
        "light",
      );
      const rendered = plan.diagrams[lens]!;
      const animation = splitAnimation(rendered.svg);
      const original = new DOMParser().parseFromString(
        rendered.svg,
        "image/svg+xml",
      );
      const colours = [
        ...original.querySelectorAll("[data-studio-highlight]"),
      ].map((element) => element.getAttribute("stroke"));
      expect(animation.pulses.length).toBeGreaterThan(0);
      animation.pulses.forEach((pulse, index) => {
        expect(pulse.highlight?.boxes).toHaveLength(2);
        expect(pulse.highlight?.colour).toBe(colours[index]);
      });
      const doc = new DOMParser().parseFromString(
        animation.svg,
        "image/svg+xml",
      );
      expect(
        doc.querySelector("animate, animateMotion, [data-studio-highlight]"),
      ).toBeNull();
    }
  } finally {
    Reflect.deleteProperty(SVGElement.prototype, "getTotalLength");
  }
});
