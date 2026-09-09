import { useState } from "react";
import {
  ArrowRight,
  Plus,
  Upload,
  Download,
  FolderOpen,
  Users,
  ArrowLeft,
} from "lucide-react";
import {
  newParticipant,
  participantTypes,
  type Workspace,
  type Participant,
} from "../domain/model";
import { TextField, Field } from "./Controls";
export function Home({
  workspace,
  onOpen,
  onCreate,
  onImport,
  onImportWorkspace,
  onExportWorkspace,
  onReset,
  onClear,
  onChange,
}: {
  workspace: Workspace;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onImportWorkspace: () => void;
  onExportWorkspace: () => void;
  onReset: () => void;
  onClear: () => void;
  onChange: (w: Workspace) => void;
}) {
  const [catalog, setCatalog] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string>();
  const p = workspace.participants.find((p) => p.id === editing);
  const edit = (patch: Partial<Participant>) =>
    onChange({
      ...workspace,
      participants: workspace.participants.map((x) =>
        x.id === editing ? { ...x, ...patch } : x,
      ),
    });
  return (
    <main className="home">
      <div className="home-heading">
        <div>
          <span className="eyebrow">Local workspace</span>
          <h1>
            {catalog
              ? "Participant catalog"
              : "Make the integration story clear."}
          </h1>
          <p>
            {catalog
              ? "Reusable systems and responsibilities, shared across your scenarios."
              : "Describe interactions in a table. Explore the architecture. Walk people through the change."}
          </p>
        </div>
        <button
          className="primary"
          onClick={
            catalog
              ? () => {
                  const p = newParticipant();
                  onChange({
                    ...workspace,
                    participants: [...workspace.participants, p],
                  });
                  setEditing(p.id);
                }
              : onCreate
          }
        >
          <Plus size={18} />
          {catalog ? "New participant" : "Create scenario"}
        </button>
      </div>
      <div className="home-actions">
        <button
          className="text-button"
          onClick={() => {
            setCatalog(!catalog);
            setEditing(undefined);
          }}
        >
          {catalog ? <ArrowLeft size={17} /> : <Users size={17} />}{" "}
          {catalog ? "Back to scenarios" : "Participant catalog"}
        </button>
        {!catalog && (
          <>
            <button className="text-button" onClick={onImport}>
              <Upload size={17} />
              Import scenario
            </button>
            <button className="text-button" onClick={onImportWorkspace}>
              <Upload size={17} />
              Import workspace
            </button>
            <button className="text-button" onClick={onExportWorkspace}>
              <Download size={17} />
              Export workspace
            </button>
          </>
        )}
      </div>
      {catalog ? (
        <div className="catalog-layout">
          <section>
            <TextField
              label="Search participants"
              value={query}
              onChange={setQuery}
            />
            <div className="catalog-list">
              {workspace.participants
                .filter((p) =>
                  p.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p) => (
                  <button
                    className={`catalog-row ${p.id === editing ? "active" : ""}`}
                    key={p.id}
                    onClick={() => setEditing(p.id)}
                  >
                    <span>
                      <strong>{p.name || "Unnamed participant"}</strong>
                      <small>
                        {p.type} · {p.owner || "No owner yet"}
                      </small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
            </div>
          </section>
          <section className="catalog-editor">
            {p ? (
              <>
                <h2>{p.name || "New participant"}</h2>
                <TextField
                  label="Participant name"
                  value={p.name}
                  onChange={(name) => edit({ name })}
                />
                <Field label="Participant type">
                  <select
                    value={p.type}
                    onChange={(e) =>
                      edit({ type: e.target.value as Participant["type"] })
                    }
                  >
                    {participantTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                {(
                  [
                    "description",
                    "domain",
                    "owner",
                    "location",
                    "trustZone",
                    "lifecycle",
                  ] as const
                ).map((key) => (
                  <TextField
                    key={key}
                    label={
                      key === "trustZone"
                        ? "Trust zone"
                        : key[0].toUpperCase() + key.slice(1)
                    }
                    value={p[key]}
                    multiline={key === "description"}
                    maxLength={key === "description" ? 2000 : 120}
                    onChange={(value) => edit({ [key]: value })}
                  />
                ))}
                {workspace.participants.some(
                  (x) =>
                    x.id !== p.id &&
                    x.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
                ) && (
                  <p className="notice">
                    Another participant uses this name. Choose a more specific
                    name to distinguish them.
                  </p>
                )}
                <button
                  className="secondary danger"
                  disabled={workspace.scenarios.some((s) =>
                    s.participantPlacements.some(
                      (x) => x.participantId === p.id,
                    ),
                  )}
                  onClick={() => {
                    onChange({
                      ...workspace,
                      participants: workspace.participants.filter(
                        (x) => x.id !== p.id,
                      ),
                    });
                    setEditing(undefined);
                  }}
                >
                  Delete unused participant
                </button>
                <small>
                  Participants used in a scenario must be removed from that
                  scenario first.
                </small>
              </>
            ) : (
              <div className="empty-inline">
                Select a participant to edit its shared details.
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {!workspace.scenarios.length && (
            <div className="empty-workspace">
              <FolderOpen size={30} />
              <h2>Your workspace is empty</h2>
              <p>
                Create your first scenario or import an existing one to begin.
              </p>
            </div>
          )}
          <div className="scenario-grid">
            {workspace.scenarios.map((s) => (
              <button
                className="scenario-card"
                key={s.id}
                onClick={() => onOpen(s.id)}
              >
                <div className="card-top">
                  <FolderOpen size={23} />
                  <span className={`mode-badge ${s.mode}`}>{s.mode}</span>
                </div>
                <h2>{s.name || "Untitled scenario"}</h2>
                <p>
                  {s.businessOutcome ||
                    "Add an outcome and begin shaping this scenario."}
                </p>
                <div className="card-bottom">
                  <span>
                    {s.participantPlacements.length} participants ·{" "}
                    {s.interactions.length} interactions
                  </span>
                  <ArrowRight size={20} />
                </div>
              </button>
            ))}
          </div>
          <div className="local-note">
            <strong>Your workspace stays in this browser.</strong>
            <p>
              No account or AI service is needed. Export your workspace to back
              up every scenario and the participant catalog in one file, or move
              them to another browser.
            </p>
            <div className="inline workspace-actions">
              <button
                className="text-button"
                onClick={onClear}
                disabled={
                  !workspace.scenarios.length && !workspace.participants.length
                }
              >
                Clear workspace
              </button>
              <button className="text-button" onClick={onReset}>
                Reset workspace to seeded example
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
