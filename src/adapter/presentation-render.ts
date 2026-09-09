import type { RenderedSvg } from "@coldtea/pr-lens-renderer";
import type { Step } from "../domain/model";

const SVG_NS = "http://www.w3.org/2000/svg";

function focusBoxes(rendered: RenderedSvg, focus: Step) {
  const atlas =
    rendered.lens === "architecture"
      ? rendered.atlas.edges
      : rendered.atlas.messages["flow-main"] || {};
  const prefix = rendered.lens === "architecture" ? "edge-" : "message-";
  return [
    ...focus.participantIds.map((id) => rendered.atlas.nodes[id]),
    ...focus.interactionIds.flatMap((id) => [
      atlas[`${prefix}${id}`],
      atlas[`${prefix}${id}-target`],
    ]),
  ].filter(Boolean);
}

/** Keep renderer paths, text, and styles as vectors. Expand the viewBox to fit
 * the slide's diagram area without stretching or rasterizing the drawing.
 * The explicit pixel dimensions are only the resolution of Office's PNG
 * fallback; the embedded SVG itself has no fixed rendering resolution.
 */
export function staticDiagramSvg(
  frozenSvg: string,
  rendered: RenderedSvg,
  focus?: Step,
) {
  const width = 1920;
  const height = 812;
  const scale = Math.min(width / rendered.width, height / rendered.height);
  const x = -(width / scale - rendered.width) / 2;
  const y = -(height / scale - rendered.height) / 2;
  const doc = new DOMParser().parseFromString(frozenSvg, "image/svg+xml");
  if (doc.querySelector("parsererror"))
    throw Error("The static diagram SVG could not be read.");
  if (doc.querySelector("animate, animateMotion, animateTransform, set"))
    throw Error(
      "Static PowerPoint diagrams must have their animation removed.",
    );
  const svg = doc.documentElement;
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `${x} ${y} ${width / scale} ${height / scale}`);
  const rect = (attributes: Record<string, string | number>) => {
    const node = doc.createElementNS(SVG_NS, "rect");
    for (const [key, value] of Object.entries(attributes))
      node.setAttribute(key, String(value));
    return node;
  };
  svg.insertBefore(
    rect({
      x,
      y,
      width: width / scale,
      height: height / scale,
      fill: rendered.theme === "dark" ? "#101820" : "#ffffff",
    }),
    svg.firstChild,
  );
  if (focus)
    for (const box of focusBoxes(rendered, focus)) {
      svg.append(
        rect({
          x: box.x - 3,
          y: box.y - 3,
          width: box.width + 6,
          height: Math.max(box.height, 14) + 6,
          fill: "none",
          stroke: rendered.theme === "dark" ? "#ffd166" : "#b66a00",
          "stroke-width": 3 / scale,
          "data-studio-focus": "true",
        }),
      );
    }
  return new XMLSerializer().serializeToString(doc);
}
export type Pulse = {
  path: SVGPathElement;
  length: number;
  duration: number;
  times: number[];
  points: number[];
  opacityTimes: number[];
  opacities: number[];
  radius: number;
  fill: string;
  highlight?: {
    colour: string;
    boxes: { x: number; y: number; width: number; height: number }[];
  };
  offset?: { x: number; y: number };
};

export function interpolate(
  times: number[],
  values: number[],
  position: number,
) {
  for (let i = 1; i < times.length; i++) {
    if (position < times[i]) {
      const span = times[i] - times[i - 1];
      return (
        values[i - 1] +
        (values[i] - values[i - 1]) *
          (span ? (position - times[i - 1]) / span : 1)
      );
    }
  }
  return values[values.length - 1];
}

/** Our renderer uses only linear animateMotion and opacity keyframes. Keep its
 * actual paths and shared clock, rather than recording wall-clock playback.
 * Reject new animation forms so renderer upgrades cannot silently lose motion.
 */
export function splitAnimation(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror"))
    throw Error("The diagram SVG could not be read.");
  const pulses: Pulse[] = [];
  const numbers = (element: Element, name: string) =>
    (element.getAttribute(name) || "").split(";").map(Number);
  for (const motion of doc.querySelectorAll("animateMotion")) {
    const circle = motion.parentElement!;
    const opacity = circle.querySelector('animate[attributeName="opacity"]');
    if (
      circle.localName !== "circle" ||
      !opacity ||
      motion.getAttribute("calcMode") !== "linear"
    )
      throw Error(
        "This diagram's animation cannot yet be exported to PowerPoint.",
      );
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", motion.getAttribute("path") || "");
    const durationText = motion.getAttribute("dur") || "";
    if (!/^\d+(\.\d+)?s$/.test(durationText))
      throw Error("Unsupported animation duration.");
    const pulse: Pulse = {
      path,
      length: path.getTotalLength(),
      duration: parseFloat(durationText),
      times: numbers(motion, "keyTimes"),
      points: numbers(motion, "keyPoints"),
      opacityTimes: numbers(opacity, "keyTimes"),
      opacities: numbers(opacity, "values"),
      radius: Number(circle.getAttribute("r")),
      fill: circle.getAttribute("fill") || "#167489",
    };
    let ancestor = circle.parentElement;
    let x = 0;
    let y = 0;
    while (ancestor) {
      const shift = ancestor
        .getAttribute("transform")
        ?.match(/^translate\(([-\d.]+),([-\d.]+)\)$/);
      if (shift) {
        x += Number(shift[1]);
        y += Number(shift[2]);
      }
      ancestor = ancestor.parentElement;
    }
    pulse.offset = { x, y };
    const highlight = circle.parentElement?.querySelector(
      "[data-studio-highlight]",
    );
    if (highlight) {
      pulse.highlight = {
        colour: highlight.getAttribute("stroke")!,
        boxes: [...highlight.querySelectorAll("rect")].map((rect) => ({
          x: Number(rect.getAttribute("x")),
          y: Number(rect.getAttribute("y")),
          width: Number(rect.getAttribute("width")),
          height: Number(rect.getAttribute("height")),
        })),
      };
      highlight.remove();
    }
    if (
      pulse.duration <= 0 ||
      pulse.times.length !== pulse.points.length ||
      pulse.opacityTimes.length !== pulse.opacities.length
    )
      throw Error("Unsupported animation keyframes.");
    pulses.push(pulse);
    circle.remove();
  }
  if (doc.querySelector("animate, animateTransform, set"))
    throw Error("This diagram contains unsupported animation.");
  return { svg: new XMLSerializer().serializeToString(doc), pulses };
}

export async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(Error("The diagram image could not be rendered."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasContext(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw Error("This browser cannot render the PowerPoint images.");
  return { canvas, context };
}

export function drawDiagram(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rendered: RenderedSvg,
  width: number,
  height: number,
  focus?: Step,
  pulses: Pulse[] = [],
  time = 0,
) {
  context.fillStyle = rendered.theme === "dark" ? "#101820" : "#ffffff";
  context.fillRect(0, 0, width, height);
  const scale = Math.min(width / rendered.width, height / rendered.height);
  context.save();
  context.translate(
    (width - rendered.width * scale) / 2,
    (height - rendered.height * scale) / 2,
  );
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, rendered.width, rendered.height);
  if (focus) {
    context.strokeStyle = rendered.theme === "dark" ? "#ffd166" : "#b66a00";
    context.lineWidth = 3 / scale;
    for (const box of focusBoxes(rendered, focus))
      context.strokeRect(
        box.x - 3,
        box.y - 3,
        box.width + 6,
        Math.max(box.height, 14) + 6,
      );
  }
  for (const pulse of pulses) {
    const fraction = (time % pulse.duration) / pulse.duration;
    const opacity = interpolate(pulse.opacityTimes, pulse.opacities, fraction);
    if (opacity <= 0) continue;
    const point = pulse.path.getPointAtLength(
      pulse.length * interpolate(pulse.times, pulse.points, fraction),
    );
    context.globalAlpha = opacity;
    context.save();
    context.translate(pulse.offset?.x ?? 0, pulse.offset?.y ?? 0);
    if (pulse.highlight) {
      context.strokeStyle = pulse.highlight.colour;
      context.lineWidth = 4;
      context.stroke(new Path2D(pulse.path.getAttribute("d")!));
      context.lineWidth = 3;
      for (const box of pulse.highlight.boxes) {
        context.beginPath();
        context.roundRect(box.x, box.y, box.width, box.height, 12);
        context.stroke();
      }
    }
    context.fillStyle = pulse.fill;
    context.beginPath();
    context.arc(point.x, point.y, pulse.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();
}
