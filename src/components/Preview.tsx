import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Maximize2 } from "lucide-react";
import type { GraphDoc } from "@coldtea/pr-lens-schema";
import type { RenderedSvg } from "@coldtea/pr-lens-renderer";
import { compileScenario, renderPreview } from "../adapter/compiler";
import type { Scenario, Participant, State, Step } from "../domain/model";
export type PreviewSnapshot = { graph: GraphDoc; state: State };
export function Preview({
  theme,
  scenario,
  catalog,
  state,
  setState,
  selected,
  onSelect,
  step,
  onSnapshot,
}: {
  theme: "light" | "dark";
  scenario: Scenario;
  catalog: Participant[];
  state: State;
  setState: (s: State) => void;
  selected?: string;
  onSelect: (id: string) => void;
  step?: Step;
  onSnapshot: (s: PreviewSnapshot | undefined) => void;
}) {
  const [lens, setLens] = useState<"architecture" | "data-flow">(
    "architecture",
  );
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [restart, setRestart] = useState(0);
  const [zoom, setZoom] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);
  const last = useRef<
    | {
        rendered: RenderedSvg;
        graph: GraphDoc;
        state: State;
        lens: "architecture" | "data-flow";
      }
    | undefined
  >(undefined);
  useEffect(() => {
    if (step)
      setLens(step.stage === "architecture" ? "architecture" : "data-flow");
  }, [step]);
  const result = useMemo(
    () => compileScenario(scenario, catalog, state),
    [scenario, catalog, state],
  );
  const rendering = useMemo(() => {
    if (!result.ok) return undefined;
    try {
      return { value: renderPreview(result.graph, lens, theme) };
    } catch {
      return {
        error:
          "This arrangement could not be drawn. Try fewer participants or review the architecture checks.",
      };
    }
  }, [result, lens, theme]);
  useEffect(
    () =>
      onSnapshot(
        result.ok && !result.omitted.length && !rendering?.error
          ? { graph: result.graph, state }
          : undefined,
      ),
    [result, state, rendering, onSnapshot],
  );
  if (rendering?.value && result.ok)
    last.current = {
      rendered: rendering.value,
      graph: result.graph,
      state,
      lens,
    };
  const stale = !result.ok || !!rendering?.error;
  const source = stale
    ? last.current
    : rendering?.value
      ? last.current
      : undefined;
  const shown = useMemo(() => {
    if (!source || source.rendered.theme === theme) return source;
    try {
      const rendered = renderPreview(source.graph, source.lens, theme);
      return rendered ? { ...source, rendered } : source;
    } catch {
      return source;
    }
  }, [source, theme]);
  useEffect(() => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    if (playing) svg.unpauseAnimations?.();
    else svg.pauseAnimations?.();
  }, [playing, shown?.rendered.svg, restart]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (media?.matches) setPlaying(false);
    };
    media?.addEventListener("change", change);
    return () => media?.removeEventListener("change", change);
  }, []);
  const r = shown?.rendered;
  const entries = r
    ? [
        ...Object.entries(r.atlas.nodes).map(([id, box]) => ({
          id,
          box,
          name: catalog.find((p) => p.id === id)?.name || "Participant",
        })),
        ...Object.entries(
          shown.lens === "architecture"
            ? r.atlas.edges
            : r.atlas.messages["flow-main"] || {},
        ).map(([id, box]) => ({
          id: id.replace(/^(edge|message)-/, ""),
          box,
          name:
            scenario.interactions.find((i) => id.endsWith(i.id))?.action ||
            "Interaction",
        })),
      ]
    : [];
  const focus = step
    ? [...step.participantIds, ...step.interactionIds]
    : selected
      ? [selected]
      : [];
  return (
    <section className="preview-panel" aria-label="Live diagram preview">
      <div className="preview-toolbar">
        <div className="segmented" aria-label="Diagram view">
          {(["architecture", "data-flow"] as const).map((l) => (
            <button
              key={l}
              aria-pressed={lens === l}
              onClick={() => setLens(l)}
            >
              {l === "architecture" ? "Architecture" : "Sequence"}
            </button>
          ))}
        </div>
        <div className="preview-controls">
          {scenario.mode === "transition" && (
            <div className="segmented compact" aria-label="Presentation state">
              {(["current", "target", "transition"] as const).map((s) => (
                <button
                  key={s}
                  aria-pressed={state === s}
                  onClick={() => setState(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
          <button
            className="icon-button"
            aria-label={zoom ? "Fit diagram" : "Enlarge diagram"}
            onClick={() => setZoom(!zoom)}
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
      {stale && (
        <div className="preview-warning" role="status">
          <strong>
            {shown
              ? `Showing the last valid ${shown.state} ${shown.lens === "architecture" ? "architecture" : "sequence"}.`
              : "Preview is waiting for a complete description."}
          </strong>
          <span>{!result.ok ? result.messages[0] : rendering?.error}</span>
        </div>
      )}
      {result.ok && result.omitted.length > 0 && (
        <div className="draft-preview-note" role="status">
          <strong>
            Preview of resolved steps · {result.omitted.length} unfinished{" "}
            {result.omitted.length === 1 ? "step" : "steps"}
          </strong>
          <span>These positions are not animated yet:</span>
          <div className="inline">
            {result.omitted.map((i) => (
              <button
                className="text-button"
                key={i.id}
                onClick={() => onSelect(i.id)}
              >
                Step {i.position}: {i.action || "Add an action"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`diagram-scroll ${zoom ? "enlarged" : ""}`}>
        {r ? (
          <div
            className="diagram-stage"
            style={{
              aspectRatio: `${r.width}/${r.height}`,
              width: zoom ? Math.max(r.width, 900) : undefined,
            }}
          >
            <div
              key={restart}
              ref={svgRef}
              className={`svg-render ${playing ? "" : "paused"}`}
              dangerouslySetInnerHTML={{ __html: r.svg }}
            />
            <div className="atlas-overlay">
              {entries.map(({ id, box, name }, n) => (
                <button
                  key={`${id}-${n}`}
                  aria-label={`Select ${name}`}
                  title={name}
                  className={`atlas-target ${focus.includes(id) ? "focused" : ""}`}
                  style={{
                    left: `${(box.x / r.width) * 100}%`,
                    top: `${(box.y / r.height) * 100}%`,
                    width: `${(box.width / r.width) * 100}%`,
                    height: `${(Math.max(box.height, 14) / r.height) * 100}%`,
                  }}
                  onClick={() => onSelect(id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-preview">
            <span className="empty-symbol">⇄</span>
            <h3>
              {lens === "data-flow"
                ? "Give your story its first interaction"
                : "Your architecture starts with participants"}
            </h3>
            <p>
              {lens === "data-flow"
                ? "Include at least two participants and one complete interaction to see the sequence."
                : "Add participants, assign their boundaries, then describe how they work together."}
            </p>
          </div>
        )}
      </div>
      <div className="preview-footer">
        <div className="inline">
          <button className="text-button" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
            {playing ? "Pause" : "Play"} traffic
          </button>
          <button
            className="icon-button"
            aria-label="Restart traffic"
            onClick={() => {
              setRestart((n) => n + 1);
              setPlaying(true);
            }}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="legend">
          <span className="added">+ Added</span>
          <span className="modified">~ Modified</span>
          <span className="removed">− Removed</span>
          <span>Unchanged</span>
        </div>
        <span className="preview-status">
          {stale
            ? "Preview held"
            : r
              ? result.ok && result.omitted.length
                ? "Resolved steps shown"
                : "Preview up to date"
              : "Ready when you are"}
        </span>
      </div>
    </section>
  );
}
