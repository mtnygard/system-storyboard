import { useInteractionRowDrag } from "./useInteractionRowDrag";
import { OverrideIcon } from "./OverrideIcon";
import {
  effectiveInteraction,
  editInteraction,
  resetOverride,
  type OverrideKey,
} from "../domain/interaction-overrides";
import {
  interactionsFor,
  moveVisible,
  populateTarget,
} from "../domain/interaction-views";
import { focusInteractionDetail } from "./interaction-focus";
import { useState } from "react";
import { QuickCapture } from "./QuickCapture";
import { missingDetails } from "../domain/drafts";
import { Copy, Star, Plus, GripVertical } from "lucide-react";
import {
  newInteraction,
  patterns,
  type State,
  uid,
  type Scenario,
  type Participant,
  type Interaction,
} from "../domain/model";
import { OrderButtons, DeleteButton } from "./Controls";
export function InteractionTable({
  scenario,
  editingState: controlledState,
  onEditingState,
  catalog,
  selected,
  onSelect,
  onChange,
  onCatalog,
}: {
  scenario: Scenario;
  editingState?: State;
  onEditingState?: (state: State) => void;
  catalog: Participant[];
  selected?: string;
  onSelect: (id: string) => void;
  onChange: (s: Scenario) => void;
  onCatalog: (p: Participant[], s?: Scenario) => void;
}) {
  const [details, setDetails] = useState(false);
  const [localState, setLocalState] = useState<State>("transition");
  const editingState = controlledState ?? localState;
  const setEditingState = onEditingState ?? setLocalState;
  const state = scenario.mode === "transition" ? editingState : scenario.mode;
  const visible = interactionsFor(scenario, state).map((i) =>
    effectiveInteraction(i, state),
  );
  const rowDrag = useInteractionRowDrag(
    scenario,
    visible,
    state,
    onChange,
    onSelect,
  );
  const pending = visible.filter((i) => missingDetails(i).length > 0);
  const targetExists = scenario.interactions.some((i) => i.target);
  const [notice, setNotice] = useState("");
  const update = (id: string, patch: Partial<Interaction>) =>
    onChange({
      ...scenario,
      interactions: scenario.interactions.map((i) =>
        i.id === id
          ? editInteraction(i, patch, state)
          : patch.hero
            ? editInteraction(i, { hero: false }, state)
            : i,
      ),
    });
  const icon = (i: Interaction, field: OverrideKey) => {
    const raw = scenario.interactions.find((item) => item.id === i.id)!;
    return (
      <OverrideIcon
        interaction={raw}
        field={field}
        state={state}
        displayValue={
          field === "fromParticipantId" || field === "toParticipantId"
            ? catalog.find((p) => p.id === raw[field])?.name
            : undefined
        }
        onReset={() =>
          onChange({
            ...scenario,
            interactions: scenario.interactions.map((item) =>
              item.id === i.id ? resetOverride(item, field) : item,
            ),
          })
        }
      />
    );
  };
  const participants = catalog.filter((p) =>
    scenario.participantPlacements.some((x) => x.participantId === p.id),
  );
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>
            Interactions <span className="count">{visible.length}</span>
          </h2>
          <p>
            Drag the row handles to reorder the story. Select a row for
            operational details.
          </p>
        </div>
        <button
          className="primary small"
          onClick={() => {
            const i = newInteraction(state);
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
      {scenario.mode === "transition" && (
        <>
          <div className="table-options">
            <div
              className="segmented compact"
              role="group"
              aria-label="Editing state"
            >
              {(["current", "target", "transition"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={state === value}
                  onClick={() => {
                    setEditingState(value);
                    setNotice("");
                  }}
                >
                  {value === "transition"
                    ? "Compare"
                    : value === "current"
                      ? "Current"
                      : "Target"}
                </button>
              ))}
            </div>
            <button
              className="secondary small"
              disabled={
                targetExists || !scenario.interactions.some((i) => i.current)
              }
              onClick={() => {
                onChange(populateTarget(scenario));
                setEditingState("target");
                setNotice(
                  "Target populated. Target fields inherit current values until you edit them.",
                );
              }}
            >
              Populate target from current
            </button>
          </div>
          <p className="editing-help">
            Editing{" "}
            {state === "transition" ? "both states for comparison" : state}.
            Diagram selection is independent. Target field edits override
            current values. Shared deletion and reordering affect both states.
            {targetExists &&
              " Target already has interactions; initialization is available for an empty target."}
          </p>
          {notice && <p role="status">{notice}</p>}
        </>
      )}
      <QuickCapture
        scenario={scenario}
        captureState={state}
        catalog={catalog}
        onChange={onChange}
        onCatalog={onCatalog}
      />
      <div className="table-options">
        {pending.length > 0 ? (
          <button
            className="secondary small"
            onClick={() => {
              onSelect(pending[0].id);
              focusInteractionDetail(pending[0]);
            }}
          >
            Complete details ({pending.length})
          </button>
        ) : (
          <span className="subtle" role="status">
            {visible.length
              ? "Required fields complete"
              : "No interactions to complete"}
          </span>
        )}
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
            {visible.map((i, n) => (
              <tr
                key={i.id}
                data-reorder-row
                className={[
                  selected === i.id ? "selected" : "",
                  rowDrag.draggingId === i.id ? "dragging" : "",
                  rowDrag.target?.id === i.id
                    ? `drop-${rowDrag.target.side}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(event) => rowDrag.over(i.id, event)}
                onDrop={(event) => rowDrag.drop(i.id, event)}
                onFocus={() => onSelect(i.id)}
                onClick={() => onSelect(i.id)}
              >
                <td>
                  <div className="inline">
                    <button
                      type="button"
                      className="icon-button row-drag-handle"
                      draggable={visible.length > 1}
                      disabled={visible.length < 2}
                      aria-label={`Drag interaction ${n + 1} to reorder`}
                      title="Drag to reorder. Up/down buttons are also available."
                      onDragStart={(event) => rowDrag.start(i.id, event)}
                      onDragEnd={rowDrag.finish}
                    >
                      <GripVertical size={16} />
                    </button>
                    <button
                      className="row-number"
                      aria-label={`Select interaction ${n + 1}`}
                      onClick={() => onSelect(i.id)}
                    >
                      {String(n + 1).padStart(2, "0")}
                    </button>
                    <OrderButtons
                      index={n}
                      count={visible.length}
                      label={`interaction ${n + 1}`}
                      onMove={(d) =>
                        onChange({
                          ...scenario,
                          interactions: moveVisible(scenario, visible, n, d),
                        })
                      }
                    />
                  </div>
                </td>
                <td>
                  {icon(i, "fromParticipantId")}
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
                  {icon(i, "action")}
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
                  {icon(i, "toParticipantId")}
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
                      {icon(i, "pattern")}
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
                      {icon(i, "technology")}
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
                        {icon(i, "animated")}
                        <input
                          type="checkbox"
                          aria-label={`Animate step ${n + 1}`}
                          checked={i.animated}
                          onChange={(e) =>
                            update(i.id, { animated: e.target.checked })
                          }
                        />
                        {icon(i, "hero")}
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
                      {missingDetails(i).length > 0
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
                        const copy = {
                          ...i,
                          id: uid("i"),
                          hero: false,
                          ...(state === "target"
                            ? { current: false, targetOverrides: undefined }
                            : state === "current"
                              ? { target: false, targetOverrides: undefined }
                              : {}),
                        };
                        const items = [...scenario.interactions];
                        items.splice(
                          items.findIndex((x) => x.id === i.id) + 1,
                          0,
                          copy,
                        );
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
    </section>
  );
}
