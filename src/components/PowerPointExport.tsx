import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { Participant, Scenario, State } from "../domain/model";
import { download } from "../domain/storage";

export function PowerPointExport({
  scenario,
  catalog,
  state,
  theme,
}: {
  scenario: Scenario;
  catalog: Participant[];
  state: State;
  theme: "light" | "dark";
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  async function exportDeck() {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError(false);
    setStatus("Preparing PowerPoint…");
    try {
      const { exportPresentation } = await import(
        "../adapter/presentation-export"
      );
      current.signal.throwIfAborted();
      const result = await exportPresentation(
        scenario,
        catalog,
        state,
        theme,
        (message) => {
          if (!current.signal.aborted) setStatus(message);
        },
        current.signal,
      );
      current.signal.throwIfAborted();
      const name =
        scenario.name
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80) || "scenario";
      download(
        `${name}-${state}-${theme}.pptx`,
        result.data,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
      setStatus(
        `PowerPoint downloaded · ${result.slideCount} slides with embedded MP4 animations.`,
      );
    } catch (cause) {
      setError(!current.signal.aborted);
      setStatus(
        current.signal.aborted
          ? "PowerPoint export cancelled."
          : cause instanceof Error
            ? cause.message
            : "PowerPoint could not be exported. Please try again.",
      );
    } finally {
      controller.current = undefined;
      setBusy(false);
    }
  }
  return (
    <section aria-label="PowerPoint export">
      <h3>PowerPoint</h3>
      <button
        className="export-option"
        disabled={busy}
        onClick={() => void exportDeck()}
      >
        <span>
          <strong>
            {busy ? "Preparing PowerPoint…" : "Download PowerPoint"}
          </strong>
          <small>
            One PPTX · Walkthrough slides + embedded MP4s · {state} · {theme}
          </small>
        </span>
        <Download size={18} />
      </button>
      {status && (
        <p
          className={error ? "notice" : "export-feedback"}
          role={error ? "alert" : "status"}
        >
          {status}
        </p>
      )}
      {busy && (
        <button
          className="secondary small"
          onClick={() => controller.current?.abort()}
        >
          Cancel PowerPoint export
        </button>
      )}
    </section>
  );
}
