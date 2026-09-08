import type { Participant, Scenario } from "./model";
/** Future importers return an editable proposal. The UI must review a proposal
 * before merging it; importers cannot write workspace state or call the renderer.
 * Implementations (OpenAPI, AsyncAPI, inventories, prose) are outside this alpha.
 */
export interface ScenarioImporter<Input> {
  readonly name: string;
  propose(
    input: Input,
    catalog: readonly Participant[],
  ): Promise<{
    scenario: Scenario;
    newParticipants: Participant[];
    reviewNotes: string[];
  }>;
}
