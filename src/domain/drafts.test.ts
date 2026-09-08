import { expect, it } from "vitest";
import { seedWorkspace } from "./seed";
import { newInteraction, WorkspaceSchema } from "./model";
import { compileScenario } from "../adapter/compiler";
import { architectureChecks } from "./checks";
import { isPendingDraft } from "./drafts";
import { scenarioExport, importScenario } from "./storage";
it("keeps unknown semantics distinct from a synchronous request and persists draft steps", () => {
  const w = seedWorkspace();
  const draft = { ...newInteraction(), action: "Check inventory" };
  w.scenarios[0].interactions.splice(1, 0, draft);
  expect(draft.pattern).toBe("not specified");
  expect(isPendingDraft(draft)).toBe(true);
  const saved = WorkspaceSchema.parse(JSON.parse(JSON.stringify(w)));
  expect(saved.scenarios[0].interactions[1]).toEqual(draft);
  const imported = importScenario(
    JSON.stringify(scenarioExport(w.scenarios[0], w.participants)),
    w,
  );
  expect(imported.scenarios[1].interactions[1].pattern).toBe("not specified");
  const result = compileScenario(w.scenarios[0], w.participants, "transition");
  if (!result.ok) throw Error(result.messages.join());
  expect(result.omitted).toEqual([
    { id: draft.id, position: 2, action: "Check inventory" },
  ]);
  expect(result.graph.flows[0].messages).toHaveLength(8);
  expect(
    architectureChecks(w.scenarios[0], w.participants).find(
      (c) => c.subject === draft.id,
    )?.blocking,
  ).toBe(false);
});
it("includes a captured step only after participants and pattern are chosen, in its original position", () => {
  const w = seedWorkspace();
  const i = {
    ...newInteraction(),
    action: "Reserve inventory",
    fromParticipantId: "p-store",
    toParticipantId: "p-sap",
  };
  w.scenarios[0].interactions.splice(1, 0, i);
  const partial = compileScenario(w.scenarios[0], w.participants, "current");
  expect(partial.ok && partial.omitted.length).toBe(1);
  i.pattern = "synchronous request";
  const ready = compileScenario(w.scenarios[0], w.participants, "current");
  if (!ready.ok) throw Error(ready.messages.join());
  expect(ready.omitted).toEqual([]);
  expect(ready.graph.flows[0].messages[1].label).toBe("Reserve inventory");
});
it("preserves validation for incomplete established interactions", () => {
  const w = seedWorkspace();
  w.scenarios[0].interactions[0].action = "";
  expect(compileScenario(w.scenarios[0], w.participants, "current").ok).toBe(
    false,
  );
});
