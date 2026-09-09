import { useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  newInteraction,
  newParticipant,
  newPlacement,
  type Participant,
  type Scenario,
  type State,
} from "../domain/model";
import { Field } from "./Controls";
import { parseCaptureLine } from "../domain/quick-capture";

function ParticipantChoice({
  label,
  value,
  onChange,
  catalog,
  onCreate,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  catalog: Participant[];
  onCreate: (name: string) => void;
}) {
  const list = useId();
  const typed = value.trim();
  const matches = catalog.filter(
    (p) => p.name.toLowerCase() === typed.toLowerCase(),
  );
  return (
    <Field label={label}>
      <input
        list={list}
        value={value}
        placeholder="Choose or leave for later"
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={list}>
        {catalog.map((p) => (
          <option key={p.id} value={p.name}>
            {p.type}
          </option>
        ))}
      </datalist>
      {typed && matches.length === 0 && (
        <button
          type="button"
          className="text-button"
          onClick={() => onCreate(typed)}
        >
          Create “{typed}”
        </button>
      )}
      {matches.length > 1 && (
        <small>
          Several participants have this name. Give them distinct names in the
          catalog first.
        </small>
      )}
    </Field>
  );
}
export function QuickCapture({
  scenario,
  captureState = scenario.mode,
  catalog,
  onChange,
  onCatalog,
}: {
  scenario: Scenario;
  captureState?: State;
  catalog: Participant[];
  onChange: (s: Scenario) => void;
  onCatalog: (p: Participant[], s?: Scenario) => void;
}) {
  const [text, setText] = useState("");
  const [structured, setStructured] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseCaptureLine(line, catalog));
  const resolve = (value: string) =>
    catalog.filter(
      (p) =>
        value.trim() &&
        p.name.trim().toLowerCase() === value.trim().toLowerCase(),
    );
  const parsed = lines.map((line) => ({
    ...line,
    fromParticipantId:
      (structured && resolve(from)[0]?.id) || line.fromParticipantId,
    toParticipantId: (structured && resolve(to)[0]?.id) || line.toParticipantId,
  }));
  const participantName = (id: string) =>
    catalog.find((p) => p.id === id)?.name;
  function add() {
    if (!parsed.length) return;
    const error = parsed.find((line) => line.error)?.error;
    if (error) {
      setNotice(error);
      return;
    }
    if (parsed.some(({ action }) => action.length > 120)) {
      setNotice(
        "Keep each action within 120 characters. Your text is still here to edit.",
      );
      return;
    }
    if (parsed.length + scenario.interactions.length > 64) {
      setNotice(
        "Capture up to 64 steps in a scenario. Split longer stories into another scenario.",
      );
      return;
    }
    if (
      structured &&
      [from, to].some((value) => value.trim() && resolve(value).length !== 1)
    ) {
      setNotice(
        "Choose a matching participant, use Create, or leave the participant blank for later.",
      );
      return;
    }
    const interactions = parsed.map(
      ({ action, fromParticipantId, toParticipantId }) => ({
        ...newInteraction(captureState),
        action,
        fromParticipantId,
        toParticipantId,
      }),
    );
    const placements = [...scenario.participantPlacements];
    const endpoints = interactions.flatMap((i) => [
      i.fromParticipantId,
      i.toParticipantId,
    ]);
    for (const participantId of new Set(endpoints.filter(Boolean)))
      if (!placements.some((p) => p.participantId === participantId))
        placements.push(
          newPlacement(
            participantId,
            scenario.boundaries[0]?.id || "",
            captureState,
          ),
        );
    onChange({
      ...scenario,
      participantPlacements: placements,
      interactions: [...scenario.interactions, ...interactions],
    });
    setText("");
    setNotice(
      `${parsed.length} ${parsed.length === 1 ? "step captured" : "steps captured"}. Complete details whenever you are ready.`,
    );
    input.current?.focus();
  }
  const previous = scenario.interactions
    .filter((i) => captureState === "transition" || i[captureState])
    .at(-1);
  const suggestion = catalog.find((p) => p.id === previous?.toParticipantId);
  return (
    <div className="quick-capture">
      <div className="capture-heading">
        <div>
          <h3>Quick capture</h3>
          <p>
            Type sender, action, and receiver using existing participant names,
            one step per line. Quotes around names are optional. You can also
            capture just an action.
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          aria-pressed={structured}
          onClick={() => setStructured(!structured)}
        >
          {structured ? "Hide participants" : "Add participants now"}
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        {structured && (
          <div className="capture-participants">
            <ParticipantChoice
              label="Capture sender"
              value={from}
              onChange={setFrom}
              catalog={catalog}
              onCreate={(name) => {
                const p = newParticipant(name);
                onCatalog([...catalog, p]);
                setFrom(p.name);
              }}
            />
            <ParticipantChoice
              label="Capture receiver"
              value={to}
              onChange={setTo}
              catalog={catalog}
              onCreate={(name) => {
                const p = newParticipant(name);
                onCatalog([...catalog, p]);
                setTo(p.name);
              }}
            />
            {suggestion && (
              <button
                type="button"
                className="text-button"
                onClick={() => setFrom(suggestion.name)}
              >
                Use {suggestion.name} as sender
              </button>
            )}
          </div>
        )}
        <Field
          label="Actions to capture"
          hint={
            structured
              ? "Selected participants override names parsed from each line. Blank selections use the parsed names."
              : "Start with the sender’s full name and end with the receiver’s full name. The text between them becomes the action."
          }
        >
          <textarea
            aria-label="Actions to capture"
            ref={input}
            value={text}
            placeholder={
              '"Customer Portal" calls "Order Service"\nCheck inventory'
            }
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                add();
              }
            }}
          />
        </Field>
        {parsed.length > 0 && (
          <div
            className="capture-parse-preview"
            role="region"
            aria-label="Capture preview"
            aria-live="polite"
          >
            <strong>Will capture</strong>
            <ol>
              {parsed.map((line, index) => (
                <li key={index}>
                  {line.error ? (
                    line.error
                  ) : (
                    <>
                      <span>
                        From:{" "}
                        {participantName(line.fromParticipantId) ||
                          "Not assigned"}
                      </span>
                      <span>Action: {line.action}</span>
                      <span>
                        To:{" "}
                        {participantName(line.toParticipantId) ||
                          "Not assigned"}
                      </span>
                      {!line.fromParticipantId && !line.toParticipantId && (
                        <small>
                          Action only — no matching sender and receiver found.
                        </small>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="capture-footer">
          <small>
            Enter to capture · Shift+Enter for another line ·{" "}
            {captureState === "transition"
              ? "Both states"
              : `${captureState} state`}
          </small>
          <button className="primary small" disabled={!text.trim()}>
            <Plus size={15} />
            Capture steps
          </button>
        </div>
      </form>
      {notice && (
        <p className="capture-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
