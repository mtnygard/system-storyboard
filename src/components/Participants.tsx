import { useState } from "react";
import { Plus, Search, ChevronRight } from "lucide-react";
import {
  dimensions,
  newParticipant,
  newPlacement,
  uid,
  reorder,
  type Scenario,
  type Participant,
  type Boundary,
} from "../domain/model";
import { Field, TextField, DeleteButton, OrderButtons } from "./Controls";
export function Participants({
  scenario,
  catalog,
  onChange,
  onCatalog,
  onSelect,
}: {
  scenario: Scenario;
  catalog: Participant[];
  onChange: (s: Scenario) => void;
  onCatalog: (p: Participant[], s?: Scenario) => void;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const add = (id: string) =>
    onChange({
      ...scenario,
      participantPlacements: [
        ...scenario.participantPlacements,
        newPlacement(id, scenario.boundaries[0]?.id || "", scenario.mode),
      ],
    });
  const updateBoundary = (id: string, patch: Partial<Boundary>) =>
    onChange({
      ...scenario,
      boundaries: scenario.boundaries.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    });
  const available = catalog.filter(
    (p) =>
      !scenario.participantPlacements.some((x) => x.participantId === p.id) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="editor-section">
      <div className="section-heading">
        <div>
          <h2>Participants & boundaries</h2>
          <p>
            Group responsibilities, then describe the connections between them.
          </p>
        </div>
        <button
          className="secondary small"
          onClick={() =>
            onChange({
              ...scenario,
              boundaries: [
                ...scenario.boundaries,
                {
                  id: uid("b"),
                  name: "New boundary",
                  subtitle: "",
                  dimension:
                    scenario.boundaries[0]?.dimension || "business domain",
                  order: scenario.boundaries.length,
                },
              ],
            })
          }
        >
          <Plus size={16} />
          Add boundary
        </button>
      </div>
      <div className="participant-tools">
        <div>
          <Field label="Find in participant catalog">
            <div className="search-input">
              <Search size={16} />
              <input
                value={search}
                placeholder="Search catalog…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>
          <div className="catalog-results">
            {available.map((p) => (
              <button
                key={p.id}
                className="catalog-choice"
                onClick={() => add(p.id)}
              >
                <span>
                  {p.name}
                  <small>{p.type}</small>
                </span>
                <Plus size={16} />
              </button>
            ))}
            {!available.length && (
              <small>No matching unused participants.</small>
            )}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const p = newParticipant(name.trim());
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
            });
            setName("");
            onSelect(p.id);
          }}
        >
          <TextField
            label="Create a participant"
            value={name}
            onChange={setName}
          />
          <button className="secondary small" disabled={!name.trim()}>
            <Plus size={16} />
            Create & add
          </button>
        </form>
      </div>
      <div className="boundary-grid">
        {scenario.boundaries.map((b, n) => (
          <div className="boundary-card" key={b.id}>
            <div className="boundary-top">
              <span className="eyebrow">Boundary {n + 1}</span>
              <div className="inline">
                <OrderButtons
                  index={n}
                  count={scenario.boundaries.length}
                  label={`boundary ${b.name}`}
                  onMove={(d) =>
                    onChange({
                      ...scenario,
                      boundaries: reorder(scenario.boundaries, n, d).map(
                        (x, order) => ({ ...x, order }),
                      ),
                    })
                  }
                />
                <DeleteButton
                  label={`Delete boundary ${b.name}`}
                  onClick={() =>
                    onChange({
                      ...scenario,
                      boundaries: scenario.boundaries.filter(
                        (x) => x.id !== b.id,
                      ),
                    })
                  }
                />
              </div>
            </div>
            <TextField
              label="Boundary name"
              value={b.name}
              onChange={(name) => updateBoundary(b.id, { name })}
            />
            <TextField
              label="Boundary subtitle"
              value={b.subtitle}
              onChange={(subtitle) => updateBoundary(b.id, { subtitle })}
            />
            <Field label="Classification">
              <select
                value={b.dimension}
                onChange={(e) =>
                  updateBoundary(b.id, {
                    dimension: e.target.value as Boundary["dimension"],
                  })
                }
              >
                {dimensions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <div className="placed-list">
              {scenario.participantPlacements
                .filter((p) => p.boundaryId === b.id)
                .map((p) => (
                  <button
                    key={p.participantId}
                    className="placed-participant"
                    onClick={() => onSelect(p.participantId)}
                  >
                    <span>
                      {catalog.find((c) => c.id === p.participantId)?.name ||
                        "Unnamed participant"}
                      <small>
                        {p.current && p.target
                          ? "Both states"
                          : p.current
                            ? "Current only"
                            : p.target
                              ? "Target only"
                              : "Hidden"}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      {scenario.participantPlacements.some(
        (p) => !scenario.boundaries.some((b) => b.id === p.boundaryId),
      ) && (
        <div className="notice">
          <strong>Needs a boundary</strong>
          {scenario.participantPlacements
            .filter(
              (p) => !scenario.boundaries.some((b) => b.id === p.boundaryId),
            )
            .map((p) => (
              <button
                className="text-button"
                key={p.participantId}
                onClick={() => onSelect(p.participantId)}
              >
                {catalog.find((c) => c.id === p.participantId)?.name ||
                  "Participant"}{" "}
                → assign in inspector
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
