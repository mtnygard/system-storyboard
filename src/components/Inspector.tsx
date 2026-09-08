import { OverrideIcon } from "./OverrideIcon";
import {
  effectiveInteraction,
  editInteraction,
  resetOverride,
  type OverrideKey,
} from "../domain/interaction-overrides";
import { focusInteractionDetail } from "./interaction-focus";
import { useState } from "react";
import { missingDetails } from "../domain/drafts";
import { X, SlidersHorizontal } from "lucide-react";
import {
  participantTypes,
  patterns,
  newInteraction,
  newParticipant,
  newPlacement,
  type Scenario,
  type Participant,
  type Interaction,
  type State,
} from "../domain/model";
import { Field, TextField, Presence, Toggle } from "./Controls";
export function Inspector({
  scenario,
  editingState = scenario.mode,
  catalog,
  selected,
  onChange,
  onCatalog,
  onClose,
  onSelect,
}: {
  scenario: Scenario;
  editingState?: State;
  catalog: Participant[];
  selected?: string;
  onChange: (s: Scenario) => void;
  onCatalog: (p: Participant[], s?: Scenario) => void;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [participantName, setParticipantName] = useState("");
  const rawInteraction = scenario.interactions.find((i) => i.id === selected);
  const interaction =
    rawInteraction && effectiveInteraction(rawInteraction, editingState);
  const icon = (field: OverrideKey) =>
    rawInteraction && (
      <OverrideIcon
        interaction={rawInteraction}
        field={field}
        state={editingState}
        displayValue={
          field === "fromParticipantId" || field === "toParticipantId"
            ? catalog.find((p) => p.id === rawInteraction[field])?.name
            : undefined
        }
        onReset={() =>
          onChange({
            ...scenario,
            interactions: scenario.interactions.map((i) =>
              i.id === selected ? resetOverride(i, field) : i,
            ),
          })
        }
      />
    );
  const placement = scenario.participantPlacements.find(
    (p) => p.participantId === selected,
  );
  const participant = placement && catalog.find((p) => p.id === selected);
  const editI = (patch: Partial<Interaction>) => {
    const placements = [...scenario.participantPlacements];
    for (const id of [patch.fromParticipantId, patch.toParticipantId].filter(
      Boolean,
    ) as string[])
      if (!placements.some((p) => p.participantId === id))
        placements.push(
          newPlacement(id, scenario.boundaries[0]?.id || "", scenario.mode),
        );
    onChange({
      ...scenario,
      participantPlacements: placements,
      interactions: scenario.interactions.map((i) =>
        i.id === selected
          ? editInteraction(i, patch, editingState)
          : patch.hero
            ? editInteraction(i, { hero: false }, editingState)
            : i,
      ),
    });
  };
  const pending = scenario.interactions
    .filter((i) => editingState === "transition" || i[editingState])
    .map((i) => effectiveInteraction(i, editingState))
    .filter((i) => missingDetails(i).length > 0);
  function nextPending() {
    const index = scenario.interactions.findIndex((i) => i.id === selected);
    const next = [
      ...scenario.interactions.slice(index + 1),
      ...scenario.interactions.slice(0, index),
    ]
      .filter((i) => editingState === "transition" || i[editingState])
      .map((i) => effectiveInteraction(i, editingState))
      .find((i) => missingDetails(i).length > 0);
    if (next) {
      onSelect(next.id);
      focusInteractionDetail(next);
    }
  }
  function continueStory(kind: "reply" | "onward" | "self") {
    if (!interaction) return;
    const next = {
      ...newInteraction(editingState),
      current: editingState === "target" ? false : interaction.current,
      target: editingState === "current" ? false : interaction.target,
      fromParticipantId: interaction.toParticipantId,
      toParticipantId:
        kind === "reply"
          ? interaction.fromParticipantId
          : kind === "self"
            ? interaction.toParticipantId
            : "",
      pattern:
        kind === "reply"
          ? ("return" as const)
          : kind === "self"
            ? ("self-action" as const)
            : ("not specified" as const),
    };
    const interactions = [...scenario.interactions];
    interactions.splice(
      interactions.findIndex((i) => i.id === interaction.id) + 1,
      0,
      next,
    );
    onChange({ ...scenario, interactions });
    onSelect(next.id);
    focusInteractionDetail(next);
  }
  return (
    <aside
      className={`inspector ${interaction || participant ? "has-selection" : ""}`}
      aria-label="Selected item inspector"
    >
      <div className="inspector-heading">
        <span className="eyebrow">
          {interaction
            ? "Interaction details"
            : participant
              ? "Participant details"
              : "Inspector"}
        </span>
        {selected && (
          <button
            className="icon-button"
            aria-label="Close inspector"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {interaction ? (
        <>
          <h2>{interaction.action || "New interaction"}</h2>
          <p className="subtle">
            Editing{" "}
            {editingState === "transition"
              ? "current / shared baseline"
              : editingState}{" "}
            fields
          </p>
          <p className="subtle">
            Step{" "}
            {scenario.interactions.findIndex((i) => i.id === interaction.id) +
              1}{" "}
            · {interaction.pattern}
          </p>
          <div className="inspector-fields">
            <div className="completion-status">
              {missingDetails(interaction).length > 0
                ? `Needs ${missingDetails(interaction).join(", ")}`
                : "Essential details complete"}
              <button
                className="text-button"
                disabled={!pending.some((i) => i.id !== selected)}
                onClick={nextPending}
              >
                Next unfinished step
              </button>
            </div>
            <div data-interaction-detail="action">
              {icon("action")}
              <TextField
                label="Interaction action"
                value={interaction.action}
                onChange={(action) => editI({ action })}
              />
            </div>
            {(
              [
                ["fromParticipantId", "Interaction sender"],
                ["toParticipantId", "Interaction receiver"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                data-interaction-detail={
                  key === "fromParticipantId" ? "sender" : "receiver"
                }
              >
                {icon(key)}
                <Field label={label}>
                  <select
                    value={interaction[key]}
                    onChange={(e) => editI({ [key]: e.target.value })}
                  >
                    <option value="">Choose later</option>
                    {catalog.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || "Unnamed participant"}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ))}
            <details>
              <summary>Create a participant</summary>
              <TextField
                label="New participant name"
                value={participantName}
                onChange={setParticipantName}
              />
              <button
                className="secondary small"
                disabled={
                  !participantName.trim() ||
                  catalog.some(
                    (p) =>
                      p.name.toLowerCase() ===
                      participantName.trim().toLowerCase(),
                  )
                }
                onClick={() => {
                  const p = newParticipant(participantName.trim());
                  const key = interaction.fromParticipantId
                    ? "toParticipantId"
                    : "fromParticipantId";
                  onCatalog([...catalog, p], {
                    ...scenario,
                    participantPlacements: [
                      ...scenario.participantPlacements,
                      newPlacement(
                        p.id,
                        scenario.boundaries[0]?.id || "",
                        scenario.mode,
                      ),
                    ],
                    interactions: scenario.interactions.map((i) =>
                      i.id === interaction.id
                        ? editInteraction(i, { [key]: p.id }, editingState)
                        : i,
                    ),
                  });
                  setParticipantName("");
                }}
              >
                Create & use as{" "}
                {interaction.fromParticipantId ? "receiver" : "sender"}
              </button>
            </details>
            <div data-interaction-detail="pattern">
              {" "}
              {icon("pattern")}
              <Field label="Interaction pattern">
                <select
                  value={interaction.pattern}
                  onChange={(e) =>
                    editI({ pattern: e.target.value as Interaction["pattern"] })
                  }
                >
                  {patterns.map((pattern) => (
                    <option key={pattern} value={pattern}>
                      {pattern === "not specified" ? "Choose later" : pattern}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="override-field">
              {icon("technology")}
              <TextField
                label="Interaction technology"
                value={interaction.technology}
                onChange={(technology) => editI({ technology })}
              />
            </div>
            <div className="continuation-actions">
              <span className="eyebrow">Continue this story</span>
              <button
                className="secondary small"
                disabled={
                  !interaction.fromParticipantId || !interaction.toParticipantId
                }
                onClick={() => continueStory("reply")}
              >
                Receiver replies
              </button>
              <button
                className="secondary small"
                disabled={!interaction.toParticipantId}
                onClick={() => continueStory("onward")}
              >
                Receiver sends onward
              </button>
              <button
                className="secondary small"
                disabled={!interaction.toParticipantId}
                onClick={() => continueStory("self")}
              >
                Receiver acts internally
              </button>
            </div>
            <Presence value={interaction} onChange={editI} />
            <div className="override-field">
              {icon("animated")}
              <Toggle
                label="Animate traffic"
                checked={interaction.animated}
                onChange={(animated) => editI({ animated })}
              />
            </div>
            <div className="override-field">
              {icon("hero")}
              <Toggle
                label="Principal interaction"
                checked={interaction.hero}
                onChange={(hero) => editI({ hero })}
              />
            </div>
            {(
              [
                ["payload", "Payload or event"],
                ["frequency", "Frequency or repeat count"],
                ["volume", "Volume"],
                ["latency", "Latency or SLA"],
                ["authentication", "Authentication"],
                ["dataClassification", "Data classification"],
                ["resilience", "Timeout, retry & idempotency"],
                ["failure", "Failure & compensation"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="override-field">
                {icon(key)}
                <TextField
                  label={label}
                  value={interaction[key]}
                  onChange={(v) => editI({ [key]: v })}
                  multiline={key === "resilience" || key === "failure"}
                  maxLength={
                    key === "resilience" || key === "failure" ? 2000 : 120
                  }
                />
              </div>
            ))}
          </div>
        </>
      ) : participant && placement ? (
        <>
          <h2>{participant.name || "Unnamed participant"}</h2>
          <p className="subtle">Catalog details are shared across scenarios.</p>
          <div className="inspector-fields">
            <TextField
              label="Participant name"
              value={participant.name}
              onChange={(name) =>
                onCatalog(
                  catalog.map((p) => (p.id === selected ? { ...p, name } : p)),
                )
              }
            />
            <Field label="Participant type">
              <select
                value={participant.type}
                onChange={(e) =>
                  onCatalog(
                    catalog.map((p) =>
                      p.id === selected
                        ? { ...p, type: e.target.value as Participant["type"] }
                        : p,
                    ),
                  )
                }
              >
                {participantTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Boundary">
              <select
                value={placement.boundaryId}
                onChange={(e) =>
                  onChange({
                    ...scenario,
                    participantPlacements: scenario.participantPlacements.map(
                      (p) =>
                        p === placement
                          ? { ...p, boundaryId: e.target.value }
                          : p,
                    ),
                  })
                }
              >
                <option value="">Choose boundary…</option>
                {scenario.boundaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Presence
              value={placement}
              onChange={(patch) =>
                onChange({
                  ...scenario,
                  participantPlacements: scenario.participantPlacements.map(
                    (p) => (p === placement ? { ...p, ...patch } : p),
                  ),
                })
              }
            />
            <TextField
              label="Display subtitle"
              value={placement.subtitle}
              onChange={(subtitle) =>
                onChange({
                  ...scenario,
                  participantPlacements: scenario.participantPlacements.map(
                    (p) => (p === placement ? { ...p, subtitle } : p),
                  ),
                })
              }
            />
            <TextField
              label="Badges (comma separated)"
              value={placement.badges.join(", ")}
              onChange={(value) =>
                onChange({
                  ...scenario,
                  participantPlacements: scenario.participantPlacements.map(
                    (p) =>
                      p === placement
                        ? {
                            ...p,
                            badges: value
                              .split(",")
                              .slice(0, 6)
                              .map((b) => b.trim()),
                          }
                        : p,
                  ),
                })
              }
            />
            {(
              [
                ["description", "Description"],
                ["domain", "Business domain"],
                ["owner", "Owner"],
                ["location", "Deployment location"],
                ["trustZone", "Trust zone"],
                ["lifecycle", "Lifecycle"],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={participant[key]}
                multiline={key === "description"}
                maxLength={key === "description" ? 2000 : 120}
                onChange={(value) =>
                  onCatalog(
                    catalog.map((p) =>
                      p.id === selected ? { ...p, [key]: value } : p,
                    ),
                  )
                }
              />
            ))}
            <button
              className="secondary danger"
              onClick={() => {
                onChange({
                  ...scenario,
                  participantPlacements: scenario.participantPlacements.filter(
                    (p) => p !== placement,
                  ),
                });
                onClose();
              }}
            >
              Remove from scenario
            </button>
            <small>
              Interactions remain so you can choose replacement participants.
            </small>
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <SlidersHorizontal size={28} />
          <h3>Details, when you need them</h3>
          <p>
            Select a participant in the diagram or an interaction row to refine
            its meaning and operational behavior.
          </p>
        </div>
      )}
    </aside>
  );
}
