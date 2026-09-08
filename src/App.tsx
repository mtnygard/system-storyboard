import { AppearanceControl } from "./components/AppearanceControl";
import { useAppearance } from "./components/useAppearance";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Layers,
  LayoutList,
  Users,
  ListOrdered,
  Clapperboard,
  ClipboardCheck,
  Undo2,
  X,
  Upload,
} from "lucide-react";
import {
  exportDiagramArchive,
  type DiagramExportResult,
} from "./adapter/diagram-export";
import { Home } from "./components/Home";
import { Preview, type PreviewSnapshot } from "./components/Preview";
import { Participants } from "./components/Participants";
import { InteractionTable } from "./components/InteractionTable";
import { Inspector } from "./components/Inspector";
import { Walkthrough } from "./components/Walkthrough";
import { TextField, Field } from "./components/Controls";
import { architectureChecks, type Check } from "./domain/checks";
import {
  newScenario,
  modes,
  type Workspace,
  type Scenario,
  type State,
  type Participant,
} from "./domain/model";
import {
  loadWorkspace,
  saveWorkspace,
  scenarioExport,
  importScenario,
  importCsv,
  download,
  STORAGE_KEY,
} from "./domain/storage";
import { seedWorkspace } from "./domain/seed";
import { renderPreview } from "./adapter/compiler";
const sections = [
  { name: "Overview", icon: LayoutList },
  { name: "Participants", icon: Users },
  { name: "Interactions", icon: ListOrdered },
  { name: "Walkthrough", icon: Clapperboard },
  { name: "Checks", icon: ClipboardCheck },
] as const;
type Section = (typeof sections)[number]["name"];
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const { appearance, setAppearance, theme } = useAppearance();
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<DiagramExportResult>();
  const [loaded] = useState(loadWorkspace);
  const [workspace, setWorkspace] = useState(loaded.workspace);
  const [saveError, setSaveError] = useState(loaded.error || "");
  const [saved, setSaved] = useState(!loaded.error);
  const protection = useRef(!!loaded.error);
  const history = useRef<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [section, setSection] = useState<Section>("Interactions");
  const [selected, setSelected] = useState<string>();
  const [state, setState] = useState<State>("transition");
  const [modal, setModal] = useState<
    "export" | "reset" | "clear" | "create" | "csv" | null
  >(null);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<PreviewSnapshot>();
  const [activeStep, setActiveStep] = useState(-1);
  const [tourPlaying, setTourPlaying] = useState(false);
  const jsonInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const scenario = workspace.scenarios.find((s) => s.id === activeId);
  const change = useCallback(
    (next: Workspace) => {
      history.current = [...history.current.slice(-39), workspace];
      setWorkspace(next);
      setSaved(false);
    },
    [workspace],
  );
  const updateScenario = (s: Scenario) =>
    change({
      ...workspace,
      scenarios: workspace.scenarios.map((x) => (x.id === s.id ? s : x)),
    });
  const updateCatalog = (participants: Participant[], s?: Scenario) =>
    change({
      ...workspace,
      participants,
      scenarios: s
        ? workspace.scenarios.map((x) => (x.id === s.id ? s : x))
        : workspace.scenarios,
    });
  useEffect(() => {
    if (protection.current) return;
    const timer = setTimeout(() => {
      const success = saveWorkspace(workspace);
      setSaved(success);
      setSaveError(
        success
          ? ""
          : "This browser could not save your changes. Export the scenario now to keep a copy.",
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [workspace]);
  useEffect(() => {
    if (!tourPlaying || !scenario?.walkthroughSteps.length) return;
    const timer = setInterval(
      () =>
        setActiveStep((n) => {
          if (n >= scenario.walkthroughSteps.length - 1) {
            setTourPlaying(false);
            return n;
          }
          return n + 1;
        }),
      5000,
    );
    return () => clearInterval(timer);
  }, [tourPlaying, scenario?.walkthroughSteps.length]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(timer);
  }, [message]);
  function open(s: Scenario) {
    setActiveId(s.id);
    setState(s.mode);
    setSelected(undefined);
    setActiveStep(-1);
    setTourPlaying(false);
    setSnapshot(undefined);
    setSection("Interactions");
  }
  function select(id: string) {
    setSelected(id);
    setActiveStep(-1);
    setTourPlaying(false);
    if (scenario?.interactions.some((i) => i.id === id))
      setSection("Interactions");
    else setSection("Participants");
  }
  function navigate(name: Section) {
    setSection(name);
    if (name !== "Walkthrough") {
      setActiveStep(-1);
      setTourPlaying(false);
    }
  }
  async function readImport(file: File | undefined, csv = false) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw Error("Choose a file smaller than 5 MB.");
      const raw = await file.text();
      if (csv && scenario) {
        updateScenario(importCsv(raw, scenario, workspace.participants));
        setMessage(
          "Interactions imported. Review the table and architecture checks.",
        );
      } else {
        const next = importScenario(raw, workspace);
        change(next);
        open(next.scenarios.at(-1)!);
        setMessage("Scenario imported as a separate copy.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The file could not be imported. Please try a Studio export.",
      );
    }
  }
  useEffect(() => {
    const flush = () => {
      if (!protection.current) saveWorkspace(workspace);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [workspace]);
  const checks = scenario
    ? architectureChecks(scenario, workspace.participants)
    : [];
  const step =
    section === "Walkthrough"
      ? scenario?.walkthroughSteps[activeStep]
      : undefined;
  const safeName = (scenario?.name || "scenario")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  const exportSvg = (
    theme: "light" | "dark",
    lens: "architecture" | "data-flow",
  ) => {
    if (!snapshot) return;
    try {
      const r = renderPreview(snapshot.graph, lens, theme);
      if (r) {
        download(
          `${safeName}-${state}-${lens}-${theme}.svg`,
          r.svg,
          "image/svg+xml",
        );
        setMessage("Standalone diagram exported.");
      }
    } catch {
      setMessage(
        "This diagram could not be exported. Review the architecture checks and try again.",
      );
    }
  };
  async function exportAllDiagrams() {
    setExporting(true);
    setExportResult(undefined);
    // Let the preparing state paint before compiling the workspace.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const targets = scenario
        ? [{ scenario, state }]
        : workspace.scenarios.map((scenario) => ({
            scenario,
            state: scenario.mode,
          }));
      const result = exportDiagramArchive(targets, workspace.participants);
      if (result.archive)
        download(
          `${scenario ? safeName : "workspace"}-diagrams.zip`,
          new Uint8Array(result.archive).buffer,
          "application/zip",
        );
      setExportResult(result);
    } catch {
      setExportResult({
        diagramCount: 0,
        issues: [
          "The diagrams could not be packaged. Try exporting one scenario at a time.",
        ],
      });
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            setActiveId(undefined);
            setTourPlaying(false);
          }}
        >
          <span className="brand-mark">
            <Layers size={23} />
          </span>
          <span>Integration Scenario Studio</span>
          <span className="alpha">ALPHA</span>
        </button>
        <div className="header-actions">
          <AppearanceControl value={appearance} onChange={setAppearance} />
          <span className={`save-status ${saved ? "" : "unsaved"}`}>
            <span />
            {saved
              ? "Saved in this browser"
              : saveError
                ? "Not saved"
                : "Saving…"}
          </span>
          {scenario && (
            <>
              <button
                className="text-button"
                disabled={!history.current.length}
                onClick={() => {
                  const prev = history.current.pop();
                  if (prev) {
                    setWorkspace(prev);
                    setSaved(false);
                  }
                }}
              >
                <Undo2 size={16} />
                Undo
              </button>
              <button
                className="secondary small"
                onClick={() => {
                  setExportResult(undefined);
                  setModal("export");
                }}
              >
                <Download size={16} />
                Export
              </button>
            </>
          )}
          {!scenario && (
            <button
              className="secondary small"
              onClick={() => {
                setExportResult(undefined);
                setModal("export");
              }}
            >
              <Download size={16} />
              Export all diagrams
            </button>
          )}
        </div>
      </header>
      {saveError && (
        <div className="storage-warning" role="alert">
          {saveError}
          {protection.current && (
            <button
              className="text-button"
              onClick={() => {
                download(
                  "studio-saved-data.json",
                  localStorage.getItem(STORAGE_KEY) || "",
                );
              }}
            >
              Download saved data
            </button>
          )}
        </div>
      )}
      <input
        ref={jsonInput}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Import Studio scenario file"
        onChange={(e) => {
          void readImport(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={csvInput}
        hidden
        type="file"
        accept=".csv,text/csv"
        aria-label="Import interaction CSV file"
        onChange={(e) => {
          void readImport(e.target.files?.[0], true);
          e.target.value = "";
        }}
      />
      {!scenario ? (
        <Home
          workspace={workspace}
          onChange={change}
          onOpen={(id) => open(workspace.scenarios.find((s) => s.id === id)!)}
          onCreate={() => {
            setNewName("");
            setModal("create");
          }}
          onImport={() => jsonInput.current?.click()}
          onReset={() => setModal("reset")}
          onClear={() => setModal("clear")}
        />
      ) : (
        <div className="workbench">
          <aside className="outline">
            <button
              className="text-button back"
              onClick={() => {
                setActiveId(undefined);
                setTourPlaying(false);
              }}
            >
              <ArrowLeft size={16} />
              All scenarios
            </button>
            <div className="outline-title">
              <span className={`mode-badge ${scenario.mode}`}>
                {scenario.mode} state
              </span>
              <h1>{scenario.name || "Untitled scenario"}</h1>
            </div>
            <nav aria-label="Scenario outline">
              {sections.map(({ name, icon: Icon }, n) => (
                <button
                  key={name}
                  className={section === name ? "active" : ""}
                  aria-current={section === name ? "page" : undefined}
                  onClick={() => navigate(name)}
                >
                  <Icon size={17} />
                  <span>{name}</span>
                  {name === "Checks" && checks.length ? (
                    <span className="nav-count">{checks.length}</span>
                  ) : (
                    <span className="nav-index">0{n + 1}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="outline-note">
              <span className="eyebrow">The story</span>
              <p>{scenario.trigger || "Add a business trigger in Overview."}</p>
              <ArrowRight size={16} />
              <p>
                {scenario.completionOutcome ||
                  "Describe what completion looks like."}
              </p>
            </div>
            <button
              className="text-button import-csv"
              onClick={() => setModal("csv")}
            >
              <Upload size={15} />
              Import interactions
            </button>
          </aside>
          <main className="main-workspace">
            <div className="workspace-title">
              <div>
                <span className="eyebrow">Scenario workbench</span>
                <h2>
                  {section === "Interactions"
                    ? "A story told through interactions"
                    : section === "Walkthrough"
                      ? "Guide the architecture conversation"
                      : section === "Participants"
                        ? "Give every participant a place"
                        : section === "Checks"
                          ? "Make the story consistent"
                          : "Start with the business outcome"}
                </h2>
              </div>
              <span className="quiet-label">
                {scenario.participantPlacements.length} participants ·{" "}
                {scenario.interactions.length} interactions
              </span>
            </div>
            <Preview
              theme={theme}
              key={scenario.id}
              scenario={scenario}
              catalog={workspace.participants}
              state={state}
              setState={setState}
              selected={selected}
              onSelect={select}
              step={step}
              onSnapshot={setSnapshot}
            />
            {step && (
              <div className="playing-caption">
                <span className="step-count">
                  {activeStep + 1}/{scenario.walkthroughSteps.length}
                </span>
                <div>
                  <strong>{step.heading}</strong>
                  <p>{step.explanation}</p>
                </div>
                <button
                  className="text-button"
                  disabled={activeStep <= 0}
                  onClick={() => {
                    setTourPlaying(false);
                    setActiveStep((n) => n - 1);
                  }}
                >
                  Previous
                </button>
                <button
                  className="text-button"
                  disabled={activeStep >= scenario.walkthroughSteps.length - 1}
                  onClick={() => {
                    setTourPlaying(false);
                    setActiveStep((n) => n + 1);
                  }}
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            {section === "Overview" && (
              <section className="editor-section">
                <div className="section-heading">
                  <div>
                    <h2>Scenario overview</h2>
                    <p>
                      A name is enough to begin. Refine the outcome as the story
                      develops.
                    </p>
                  </div>
                </div>
                <div className="overview-form">
                  <TextField
                    label="Scenario name"
                    value={scenario.name}
                    onChange={(name) => updateScenario({ ...scenario, name })}
                  />
                  <Field label="Scenario describes">
                    <select
                      value={scenario.mode}
                      onChange={(e) => {
                        const mode = e.target.value as State;
                        updateScenario({ ...scenario, mode });
                        setState(mode);
                      }}
                    >
                      {modes.map((m) => (
                        <option key={m} value={m}>
                          {m === "transition"
                            ? "Transition between current and target"
                            : m === "current"
                              ? "Current state"
                              : "Target state"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {(
                    [
                      ["businessOutcome", "Business outcome"],
                      ["trigger", "Business trigger"],
                      ["completionOutcome", "Completion outcome"],
                    ] as const
                  ).map(([key, label]) => (
                    <TextField
                      key={key}
                      label={label}
                      value={scenario[key]}
                      onChange={(v) =>
                        updateScenario({ ...scenario, [key]: v })
                      }
                      multiline
                      maxLength={2000}
                    />
                  ))}
                </div>
                <button
                  className="primary small"
                  onClick={() => navigate("Participants")}
                >
                  Choose participants
                  <ArrowRight size={16} />
                </button>
              </section>
            )}
            {section === "Participants" && (
              <Participants
                scenario={scenario}
                catalog={workspace.participants}
                onChange={updateScenario}
                onCatalog={updateCatalog}
                onSelect={setSelected}
              />
            )}
            {section === "Interactions" && (
              <InteractionTable
                scenario={scenario}
                catalog={workspace.participants}
                selected={selected}
                onSelect={setSelected}
                onChange={updateScenario}
                onCatalog={updateCatalog}
              />
            )}
            {section === "Walkthrough" && (
              <Walkthrough
                scenario={scenario}
                catalog={workspace.participants}
                onChange={updateScenario}
                active={activeStep}
                onActive={setActiveStep}
                playing={tourPlaying}
                onPlaying={setTourPlaying}
              />
            )}
            {section === "Checks" && (
              <section className="editor-section">
                <div className="section-heading">
                  <div>
                    <h2>Architecture checks</h2>
                    <p>
                      Questions to strengthen the explanation. Drafts are always
                      saved.
                    </p>
                  </div>
                </div>
                {!checks.length ? (
                  <div className="checks-clear">
                    <CheckCircle2 size={28} />
                    <h3>The story is consistent.</h3>
                    <p>
                      No issues found by the alpha checks. Use the walkthrough
                      to review the architecture with your team.
                    </p>
                  </div>
                ) : (
                  (
                    [
                      "Incomplete description",
                      "Internal inconsistency",
                      "Diagram readability",
                      "Advisory recommendation",
                    ] as Check["severity"][]
                  ).map((severity) => {
                    const group = checks.filter((c) => c.severity === severity);
                    return group.length ? (
                      <div className="check-group" key={severity}>
                        <h3>
                          {severity}
                          <span className="count">{group.length}</span>
                        </h3>
                        {group.map((c) => (
                          <button
                            key={c.id}
                            className="check-item"
                            onClick={() => {
                              navigate(c.section);
                              setSelected(c.subject);
                              if (c.section === "Walkthrough")
                                setActiveStep(
                                  scenario.walkthroughSteps.findIndex(
                                    (s) => s.id === c.subject,
                                  ),
                                );
                            }}
                          >
                            <span
                              className={`check-dot ${c.blocking ? "blocking" : ""}`}
                            />
                            <span>{c.message}</span>
                            <ArrowRight size={17} />
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })
                )}
              </section>
            )}
          </main>
          <Inspector
            scenario={scenario}
            catalog={workspace.participants}
            selected={selected}
            onChange={updateScenario}
            onCatalog={updateCatalog}
            onClose={() => setSelected(undefined)}
            onSelect={setSelected}
          />
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal === "csv" && (
        <Modal title="Import interactions" onClose={() => setModal(null)}>
          <p>
            Import a CSV with <strong>From, Action, To</strong> headings. Use
            participant names from your catalog. Pattern and Technology columns
            are optional.
          </p>
          <p>
            Rows are appended in file order. Patterns use the same names as the
            interaction table, such as “synchronous request” or “asynchronous
            message”.
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() =>
                download(
                  "interaction-template.csv",
                  "From,Action,To,Pattern,Technology\nCustomer,Submit order,Order Portal,synchronous request,HTTPS\n",
                  "text/csv",
                )
              }
            >
              Download example
            </button>
            <button
              className="primary"
              onClick={() => {
                setModal(null);
                csvInput.current?.click();
              }}
            >
              Choose CSV
              <Upload size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "create" && (
        <Modal title="Create a scenario" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              const s = newScenario(newName.trim());
              change({ ...workspace, scenarios: [...workspace.scenarios, s] });
              open(s);
              setSection("Overview");
              setModal(null);
            }}
          >
            <p>
              Start with a name. Add the participants and interactions as you
              explore the story.
            </p>
            <TextField
              label="Scenario name"
              value={newName}
              onChange={setNewName}
            />
            <button className="primary" disabled={!newName.trim()}>
              Create scenario
              <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "clear" && (
        <Modal title="Clear this workspace?" onClose={() => setModal(null)}>
          <p>
            This removes all {workspace.scenarios.length} scenarios and{" "}
            {workspace.participants.length} catalog participants from this
            browser. Export anything you want to keep first. This cannot be
            undone.
          </p>
          <div className="modal-actions">
            <button
              autoFocus
              className="secondary"
              onClick={() => setModal(null)}
            >
              Keep workspace
            </button>
            <button
              className="primary danger-fill"
              onClick={() => {
                protection.current = false;
                change({ ...workspace, scenarios: [], participants: [] });
                history.current = [];
                setActiveId(undefined);
                setSelected(undefined);
                setSnapshot(undefined);
                setActiveStep(-1);
                setTourPlaying(false);
                setExportResult(undefined);
                setModal(null);
                setMessage(
                  "Workspace cleared. Create a scenario or import one to begin.",
                );
              }}
            >
              Clear workspace
            </button>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Reset this workspace?" onClose={() => setModal(null)}>
          <p>
            This replaces all local scenarios and catalog participants with the
            Order to SAP example. Export anything you want to keep first.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Keep workspace
            </button>
            <button
              className="primary danger-fill"
              onClick={() => {
                protection.current = false;
                change(seedWorkspace());
                setActiveId(undefined);
                setModal(null);
                setMessage("Workspace reset to Order to SAP.");
              }}
            >
              Reset workspace
            </button>
          </div>
        </Modal>
      )}
      {modal === "export" && (
        <Modal
          title={
            scenario ? "Export this scenario" : "Export workspace diagrams"
          }
          onClose={() => setModal(null)}
        >
          <p>
            {scenario ? (
              <>
                Download architecture and sequence diagrams for the{" "}
                <strong>{state}</strong> presentation.
              </>
            ) : (
              <>
                Download architecture and sequence diagrams from all{" "}
                {workspace.scenarios.length} scenarios. Each scenario uses its
                own current, target, or transition mode.
              </>
            )}
          </p>
          <button
            className="export-option"
            disabled={exporting || (!scenario && !workspace.scenarios.length)}
            onClick={() => void exportAllDiagrams()}
          >
            <span>
              <strong>
                {exporting ? "Preparing diagrams…" : "Export all diagrams"}
              </strong>
              <small>
                One ZIP · Light and dark SVGs
                {!scenario && " · Organized by scenario"}
              </small>
            </span>
            <Download size={18} />
          </button>
          {exportResult && (
            <div
              className={
                exportResult.issues.length ? "notice" : "export-feedback"
              }
              role="status"
            >
              <strong>
                {exportResult.diagramCount
                  ? `${exportResult.diagramCount} diagrams exported${exportResult.issues.length ? " — some diagrams were unavailable" : ""}.`
                  : "No diagrams exported."}
              </strong>
              {exportResult.issues.length > 0 && (
                <>
                  <p>
                    Review the items below and export again when they are ready.
                    {exportResult.archive &&
                      " These notes are also included in the ZIP."}
                  </p>
                  <ul>
                    {exportResult.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {scenario && (
            <>
              <h3>Standalone diagrams</h3>
              {(["architecture", "data-flow"] as const).map((lens) => (
                <div className="export-row" key={lens}>
                  <span>
                    {lens === "architecture" ? "Architecture" : "Sequence"}
                  </span>
                  {(["light", "dark"] as const).map((theme) => (
                    <button
                      className="secondary small"
                      key={theme}
                      disabled={!snapshot?.graph.lenses.includes(lens)}
                      onClick={() => exportSvg(theme, lens)}
                    >
                      {theme === "light" ? "Light" : "Dark"} SVG
                      <Download size={14} />
                    </button>
                  ))}
                </div>
              ))}
              <h3>Editable scenario</h3>
              <button
                className="export-option"
                onClick={() =>
                  download(
                    `${safeName}.studio.json`,
                    JSON.stringify(
                      scenarioExport(scenario, workspace.participants),
                      null,
                      2,
                    ),
                  )
                }
              >
                <span>
                  <strong>Studio scenario</strong>
                  <small>Re-importable copy with all enterprise details</small>
                </span>
                <Download size={18} />
              </button>
              {!snapshot && (
                <p className="notice">
                  Complete the highlighted checks to export the current
                  diagrams. Your Studio scenario can still be exported.
                </p>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
