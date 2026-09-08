import { focusInteractionDetail } from "./interaction-focus";
import { useState } from "react";
import { QuickCapture } from "./QuickCapture";
import { isPendingDraft, missingDetails } from "../domain/drafts";
import { Copy, Star, Plus } from "lucide-react";
import {
  newInteraction,
  patterns,
  reorder,
  uid,
  type Scenario,
  type Participant,
  type Interaction,
} from "../domain/model";
import { OrderButtons, DeleteButton } from "./Controls";
export function InteractionTable({
  scenario,
  catalog,
  selected,
  onSelect,
  onChange,
  onCatalog,
}: {
  scenario: Scenario;
  catalog: Participant[];
  selected?: string;
  onSelect: (id: string) => void;
  onChange: (s: Scenario) => void;
  onCatalog: (p: Participant[], s?: Scenario) => void;
}) {
  const [details, setDetails] = useState(false);
  const pending = scenario.interactions.filter(isPendingDraft);
  const update = (id: string, patch: Partial<Interaction>) =>
    onChange({
      ...scenario,
      interactions: scenario.interactions.map((i) =>
        i.id === id
          ? { ...i, ...patch }
          : patch.hero
            ? { ...i, hero: false }
            : i,
      ),
    });
  const participants = catalog.filter((p) =>
    scenario.participantPlacements.some((x) => x.participantId === p.id),
  );
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>
            Interactions{" "}
            <span className="count">{scenario.interactions.length}</span>
          </h2>
          <p>Tell the story in order. Select a row for operational details.</p>
        </div>
        <button
          className="primary small"
          onClick={() => {
            const i = newInteraction(scenario.mode);
            onChange({
              ...scenario,
              interactions: [...scenario.interactions, i],
            });
            onSelect(i.id);
          }}
        >
          <Plus size={16} />
          Add interaction
        </button>
      </div>
      <QuickCapture
        scenario={scenario}
        catalog={catalog}
        onChange={onChange}
        onCatalog={onCatalog}
      />
      <div className="table-options">
        <button
          className="secondary small"
          disabled={!pending.length}
          onClick={() => {
            onSelect(pending[0].id);
            focusInteractionDetail(pending[0]);
          }}
        >
          Complete details{pending.length ? ` (${pending.length})` : ""}
        </button>
        <button
          className="text-button"
          aria-pressed={details}
          onClick={() => setDetails(!details)}
        >
          {details ? "Hide detail columns" : "Show detail columns"}
        </button>
      </div>
      <div className="table-scroll">
        <table
          className={`interaction-table ${details ? "" : "capture-table"}`}
        >
          <thead>
            <tr>
              {[
                "Order",
                "From",
                "Action",
                "To",
                ...(details
                  ? ["Pattern", "Technology", "State", "Traffic"]
                  : ["Details"]),
                "",
              ].map((h, n) => (
                <th key={n} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.interactions.map((i, n) => (
              <tr
                key={i.id}
                className={selected === i.id ? "selected" : ""}
                onFocus={() => onSelect(i.id)}
                onClick={() => onSelect(i.id)}
              >
                <td>
                  <div className="inline">
                    <button
                      className="row-number"
                      aria-label={`Select interaction ${n + 1}`}
                      onClick={() => onSelect(i.id)}
                    >
                      {String(n + 1).padStart(2, "0")}
                    </button>
                    <OrderButtons
                      index={n}
                      count={scenario.interactions.length}
                      label={`interaction ${n + 1}`}
                      onMove={(d) =>
                        onChange({
                          ...scenario,
                          interactions: reorder(scenario.interactions, n, d),
                        })
                      }
                    />
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`From for step ${n + 1}`}
                    aria-invalid={!i.draft && !i.fromParticipantId}
                    value={i.fromParticipantId}
                    onChange={(e) =>
                      update(i.id, { fromParticipantId: e.target.value })
                    }
                  >
                    <option value="">Choose sender…</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || "Unnamed"}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Action for step ${n + 1}`}
                    aria-invalid={!i.draft && !i.action.trim()}
                    maxLength={120}
                    placeholder="Describe action…"
                    value={i.action}
                    onChange={(e) => update(i.id, { action: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={`To for step ${n + 1}`}
                    aria-invalid={!i.draft && !i.toParticipantId}
                    value={i.toParticipantId}
                    onChange={(e) =>
                      update(i.id, { toParticipantId: e.target.value })
                    }
                  >
                    <option value="">Choose destination…</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || "Unnamed"}
                      </option>
                    ))}
                  </select>
                </td>
                {details ? (
                  <>
                    <td>
                      <select
                        aria-label={`Pattern for step ${n + 1}`}
                        value={i.pattern}
                        onChange={(e) =>
                          update(i.id, {
                            pattern: e.target.value as Interaction["pattern"],
                          })
                        }
                      >
                        {patterns.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Technology for step ${n + 1}`}
                        maxLength={120}
                        placeholder="Optional"
                        value={i.technology}
                        onChange={(e) =>
                          update(i.id, { technology: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`State for step ${n + 1}`}
                        value={
                          i.current && i.target
                            ? "both"
                            : i.current
                              ? "current"
                              : i.target
                                ? "target"
                                : "neither"
                        }
                        onChange={(e) =>
                          update(i.id, {
                            current: ["both", "current"].includes(
                              e.target.value,
                            ),
                            target: ["both", "target"].includes(e.target.value),
                          })
                        }
                      >
                        <option value="both">Both</option>
                        <option value="current">Current</option>
                        <option value="target">Target</option>
                        <option value="neither">Hidden</option>
                      </select>
                    </td>
                    <td>
                      <div className="inline">
                        <input
                          type="checkbox"
                          aria-label={`Animate step ${n + 1}`}
                          checked={i.animated}
                          onChange={(e) =>
                            update(i.id, { animated: e.target.checked })
                          }
                        />
                        <button
                          className={`icon-button ${i.hero ? "hero-selected" : ""}`}
                          aria-label={`Principal interaction ${n + 1}`}
                          aria-pressed={i.hero}
                          onClick={() => update(i.id, { hero: !i.hero })}
                        >
                          <Star
                            size={15}
                            fill={i.hero ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <td>
                    <button
                      className="draft-status text-button"
                      onClick={() => onSelect(i.id)}
                    >
                      {isPendingDraft(i)
                        ? `Needs ${missingDetails(i).join(", ")}`
                        : i.pattern}
                    </button>
                  </td>
                )}
                <td>
                  <div className="inline">
                    <button
                      className="icon-button"
                      aria-label={`Duplicate step ${n + 1}`}
                      onClick={() => {
                        const copy = { ...i, id: uid("i"), hero: false };
                        const items = [...scenario.interactions];
                        items.splice(n + 1, 0, copy);
                        onChange({ ...scenario, interactions: items });
                        onSelect(copy.id);
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    <DeleteButton
                      label={`Delete step ${n + 1}`}
                      onClick={() =>
                        onChange({
                          ...scenario,
                          interactions: scenario.interactions.filter(
                            (x) => x.id !== i.id,
                          ),
                        })
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!scenario.interactions.length && (
        <div className="empty-inline">
          Start with the business trigger. Who does what, and who receives it?
        </div>
      )}
    </section>
  );
}
