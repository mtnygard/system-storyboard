import { Play, Pause, Plus, RotateCcw } from "lucide-react";
import {
  generateWalkthrough,
  reorder,
  uid,
  type Scenario,
  type Participant,
  type Step,
} from "../domain/model";
import {
  TextField,
  Field,
  Toggle,
  OrderButtons,
  DeleteButton,
} from "./Controls";
export function Walkthrough({
  scenario,
  catalog,
  onChange,
  active,
  onActive,
  playing,
  onPlaying,
}: {
  scenario: Scenario;
  catalog: Participant[];
  onChange: (s: Scenario) => void;
  active: number;
  onActive: (n: number) => void;
  playing: boolean;
  onPlaying: (v: boolean) => void;
}) {
  const edit = (id: string, patch: Partial<Step>) =>
    onChange({
      ...scenario,
      walkthroughSteps: scenario.walkthroughSteps.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  const toggleId = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Walkthrough</h2>
          <p>A short explanation, one focused moment at a time.</p>
        </div>
        <div className="inline">
          <button
            className="secondary small"
            onClick={() => {
              if (
                scenario.walkthroughSteps.length &&
                !window.confirm(
                  "Replace the existing walkthrough cards with a new walkthrough from the interaction table?",
                )
              )
                return;
              onChange({
                ...scenario,
                walkthroughSteps: generateWalkthrough(scenario, catalog),
              });
              onActive(-1);
              onPlaying(false);
            }}
          >
            <RotateCcw size={15} />
            {scenario.walkthroughSteps.length ? "Regenerate" : "Generate"} cards
          </button>
          <button
            className="primary small"
            disabled={!scenario.walkthroughSteps.length}
            onClick={() => {
              if (active < 0 || active >= scenario.walkthroughSteps.length - 1)
                onActive(0);
              onPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
            {playing ? "Pause" : "Play"} walkthrough
          </button>
        </div>
      </div>
      <div className="storyboard">
        {scenario.walkthroughSteps.map((step, n) => (
          <article
            className={`story-card ${active === n ? "active" : ""}`}
            key={step.id}
          >
            <div className="story-top">
              <button
                className="step-selector"
                onClick={() => {
                  onActive(n);
                  onPlaying(false);
                }}
                aria-label={`Show walkthrough step ${n + 1}`}
              >
                {String(n + 1).padStart(2, "0")}
                <Play size={14} />
              </button>
              <OrderButtons
                index={n}
                count={scenario.walkthroughSteps.length}
                label={`walkthrough step ${n + 1}`}
                onMove={(d) => {
                  onChange({
                    ...scenario,
                    walkthroughSteps: reorder(scenario.walkthroughSteps, n, d),
                  });
                  onActive(n + d);
                }}
              />
              <DeleteButton
                label={`Delete walkthrough step ${n + 1}`}
                onClick={() => {
                  onChange({
                    ...scenario,
                    walkthroughSteps: scenario.walkthroughSteps.filter(
                      (x) => x.id !== step.id,
                    ),
                  });
                  onActive(-1);
                  onPlaying(false);
                }}
              />
            </div>
            <TextField
              label="Heading"
              value={step.heading}
              maxLength={48}
              onChange={(heading) => edit(step.id, { heading })}
            />
            <TextField
              label="Explanation"
              value={step.explanation}
              maxLength={140}
              multiline
              onChange={(explanation) => edit(step.id, { explanation })}
            />
            <Field label="Diagram stage">
              <select
                value={step.stage}
                onChange={(e) =>
                  edit(step.id, { stage: e.target.value as Step["stage"] })
                }
              >
                <option value="architecture">Architecture overview</option>
                <option value="sequence">Sequence flow</option>
              </select>
            </Field>
            <details>
              <summary>
                Focus ·{" "}
                {step.participantIds.length + step.interactionIds.length ||
                  "whole diagram"}
              </summary>
              <div className="focus-options">
                {scenario.participantPlacements.map((p) => (
                  <Toggle
                    key={p.participantId}
                    label={
                      catalog.find((c) => c.id === p.participantId)?.name ||
                      "Participant"
                    }
                    checked={step.participantIds.includes(p.participantId)}
                    onChange={() =>
                      edit(step.id, {
                        participantIds: toggleId(
                          step.participantIds,
                          p.participantId,
                        ),
                      })
                    }
                  />
                ))}
                {scenario.interactions.map((i, n) => (
                  <Toggle
                    key={i.id}
                    label={`${n + 1}. ${i.action || "Unnamed interaction"}`}
                    checked={step.interactionIds.includes(i.id)}
                    onChange={() =>
                      edit(step.id, {
                        interactionIds: toggleId(step.interactionIds, i.id),
                      })
                    }
                  />
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
      <button
        className="secondary small"
        disabled={scenario.walkthroughSteps.length >= 12}
        onClick={() =>
          onChange({
            ...scenario,
            walkthroughSteps: [
              ...scenario.walkthroughSteps,
              {
                id: uid("step"),
                heading: "New moment",
                explanation: "Describe what the reviewer should notice.",
                stage: "architecture",
                participantIds: [],
                interactionIds: [],
              },
            ],
          })
        }
      >
        <Plus size={15} />
        Add card
      </button>
      <small className="footnote">
        Up to 12 cards. Playback advances every 5 seconds; selecting a card
        pauses playback.
      </small>
    </section>
  );
}
