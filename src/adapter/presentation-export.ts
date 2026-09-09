import pptxgen from "pptxgenjs";
import { planPresentation, type PresentationPlan } from "./presentation-plan";
import {
  canvasContext,
  drawDiagram,
  loadSvg,
  splitAnimation,
  staticDiagramSvg,
} from "./presentation-render";
import { encodeMp4 } from "./mp4-encoder";
import { addVideoPlayback } from "./presentation-playback";
import type { Participant, Scenario, State } from "../domain/model";

export type PresentationAsset = {
  heading: string;
  explanation: string;
  image: string;
  video?: Uint8Array;
};

const base64 = (bytes: Uint8Array) => {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    result += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(result);
};

/** A normal OOXML deck: every media relationship points inside the ZIP. */
export async function packagePresentation(
  plan: Pick<PresentationPlan, "title" | "state" | "theme">,
  assets: PresentationAsset[],
): Promise<ArrayBuffer> {
  const deck = new pptxgen();
  deck.layout = "LAYOUT_WIDE";
  deck.title = plan.title;
  deck.subject = `${plan.state} scenario diagrams and walkthrough`;
  deck.author = "Integration Scenario Studio";
  deck.company = "";
  deck.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  const dark = plan.theme === "dark";
  const foreground = dark ? "EDF2F7" : "182534";
  for (const asset of assets) {
    const slide = deck.addSlide();
    slide.background = { color: dark ? "101820" : "FFFFFF" };
    slide.addText(asset.heading, {
      x: 0.45,
      y: 0.2,
      w: 12.4,
      h: 0.55,
      fontSize: 28,
      bold: true,
      color: foreground,
      margin: 0,
      breakLine: false,
      fit: "shrink",
    });
    slide.addText(asset.explanation, {
      x: 0.45,
      y: 0.85,
      w: 12.4,
      h: 0.65,
      fontSize: 17,
      color: foreground,
      margin: 0,
      fit: "shrink",
    });
    const position = { x: 0.45, y: 1.65, w: 12.4, h: 5.25 };
    // Keep a regular picture beneath the movie too. PDF renderers and viewers
    // that omit media objects can still show the diagram on this slide.
    // PptxGenJS embeds SVG sources with an asvg:svgBlip relationship and
    // generates the PNG fallback for Office versions without SVG support.
    slide.addImage({ ...position, data: asset.image });
    if (asset.video)
      slide.addMedia({
        ...position,
        type: "video",
        extn: "mp4",
        data: `video/mp4;base64,${base64(asset.video)}`,
        cover: asset.image,
      });
    slide.addText(
      `${plan.state[0].toUpperCase() + plan.state.slice(1)} · ${asset.video ? "Animation · Click to play" : "Walkthrough"}`,
      {
        x: 0.45,
        y: 7.12,
        w: 12.4,
        h: 0.2,
        fontSize: 10,
        color: foreground,
        margin: 0,
      },
    );
    slide.addNotes(
      `${asset.heading}\n${asset.explanation}\nPresentation state: ${plan.state}.`,
    );
  }
  const data = (await deck.write({
    outputType: "arraybuffer",
    compression: true,
  })) as ArrayBuffer;
  return addVideoPlayback(data);
}

export async function exportPresentation(
  scenario: Scenario,
  catalog: Participant[],
  state: State,
  theme: "light" | "dark",
  progress: (message: string) => void,
  signal: AbortSignal,
) {
  const plan = planPresentation(scenario, catalog, state, theme);
  await document.fonts?.ready;
  const assets: PresentationAsset[] = [];
  const prepared = new Map<
    string,
    { image: HTMLImageElement; animation: ReturnType<typeof splitAnimation> }
  >();
  for (const [view, diagram] of Object.entries(plan.diagrams)) {
    signal.throwIfAborted();
    const animation = splitAnimation(diagram.svg);
    prepared.set(view, { animation, image: await loadSvg(animation.svg) });
  }
  for (const [index, slide] of plan.slides.entries()) {
    signal.throwIfAborted();
    progress(
      `Preparing walkthrough slide ${index + 1} of ${plan.slides.length}…`,
    );
    const svg = staticDiagramSvg(
      prepared.get(slide.view)!.animation.svg,
      plan.diagrams[slide.view]!,
      slide.focus,
    );
    assets.push({
      heading: slide.heading,
      explanation: slide.explanation,
      image: `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg))}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const video = canvasContext(1440, 610);
  for (const [view, diagram] of Object.entries(plan.diagrams)) {
    signal.throwIfAborted();
    const { image, animation } = prepared.get(view)!;
    const label = view === "architecture" ? "Architecture" : "Sequence";
    const duration = animation.pulses.length
      ? Math.max(...animation.pulses.map((pulse) => pulse.duration))
      : 3;
    const drawFrame = (time: number) =>
      drawDiagram(
        video.context,
        image,
        diagram,
        1440,
        610,
        undefined,
        animation.pulses,
        time,
      );
    drawFrame(0);
    const poster = video.canvas.toDataURL("image/png");
    const bytes = await encodeMp4(
      video.context,
      duration,
      drawFrame,
      (fraction) =>
        progress(
          `Encoding ${label.toLowerCase()} animation… ${Math.round(fraction * 100)}%`,
        ),
      signal,
    );
    assets.push({
      heading: plan.title,
      explanation: `${label} animation`,
      image: poster,
      video: bytes,
    });
  }
  signal.throwIfAborted();
  progress("Packaging PowerPoint…");
  const data = await packagePresentation(plan, assets);
  signal.throwIfAborted();
  return { data, slideCount: assets.length };
}
