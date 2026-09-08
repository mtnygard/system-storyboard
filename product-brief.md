# Integration Scenario Studio

## Alpha build brief for a project agent

### Assignment

Build an experimental, local-first web application that lets skilled enterprise and integration architects create animated architecture explanations without writing graph JSON or code.

The product is an **Integration Scenario Studio**. Its primary authoring surface is a structured, ordered interaction table backed by a reusable participant catalog. The application compiles that authoring model into a PR Lens graph document and displays PR Lens's deterministic architecture and animated data-flow SVGs.

### Relationship to PR Lens

This is a **separate experimental product inspired by PR Lens**, not a PR Lens fork intended for upstream contribution or eventual merger into its mainline repository.

PR Lens provides useful prior art in four areas:

- A semantic graph document between analysis and presentation
- Deterministic diagram layout
- Self-contained animated SVG output
- Ordered walkthroughs backed by an element-coordinate atlas

Use those ideas as inspiration and, where appropriate, consume PR Lens's published schema and renderer packages as dependencies. Do not assume that Integration Scenario Studio's product model, interface vocabulary, roadmap, or enterprise-specific requirements belong in PR Lens itself. Do not prepare upstream pull requests or reshape the experiment around what PR Lens maintainers might accept.

Keep all Studio-specific code, types, UX, documentation, and tests in the Studio project and under its own naming. If PR Lens packages prove too restrictive, place compatibility behind the adapter described below and implement or replace only the necessary rendering capability inside this project. Do not modify a local PR Lens checkout as the primary implementation strategy.

Respect PR Lens's license and retain any notices required for code that is copied or adapted. Clearly distinguish copied or adapted implementation from independently developed Studio code. Architectural ideas and interaction patterns may be reinterpreted freely, but source code should not be copied casually when a package dependency or small original implementation is sufficient.

This is an alpha intended to test one hypothesis:

> Can an architect describe a current-state, target-state, or transition integration scenario faster and more accurately through familiar forms and tables than through a diagramming canvas, while still receiving an attractive animated explanation?

Do not stop after producing a plan. Inspect the current project, make compatible implementation choices, and build a working vertical slice. Preserve the project's existing conventions and follow any `AGENTS.md` or repository-specific instructions. If the repository is greenfield, prefer React, TypeScript, and Vite unless the environment strongly suggests another lightweight web stack.

## Product principles

1. **The graph is compiled output, not authored data.** Users never need to see or edit PR Lens JSON.
2. **The scenario is the center of the product.** Start with a business trigger and outcome, not a blank canvas.
3. **Tables are for authoring; diagrams are for understanding.** Direct manipulation is limited to meaningful corrections such as renaming, regrouping, hiding, or emphasizing an element.
4. **Architecture semantics stay separate from presentation.** Maintain a small domain model for participants, boundaries, interactions, states, and walkthrough steps, then compile it into PR Lens.
5. **AI assistance is optional and reviewable.** The core alpha must work without an AI service or API key. Leave clean extension points for future extraction from prose or documents.
6. **Stable output matters.** A small semantic edit should not unnecessarily rearrange unrelated parts of the diagram.
7. **Use architects' language.** Say participant, system, boundary, interaction, scenario, current state, and target state—not node, edge, lane, or delta.

## Target users

The primary user is an experienced enterprise, solution, or integration architect. They understand systems, interfaces, protocols, trust boundaries, asynchronous messaging, current and target states, and operational characteristics. They may not write code and should not need to understand JSON schemas, package managers, SVG, or Git.

Assume desktop use with a keyboard and mouse. Optimize first for workshops, architecture reviews, solution proposals, and migration discussions.

## Core user journey

The alpha must support this complete journey:

1. Open the application and choose a seeded example or create a scenario.
2. Enter a scenario name, business outcome, trigger, and completion outcome.
3. Choose whether the scenario describes the current state, target state, or a transition between them.
4. Add participants from a small reusable catalog or create them inline.
5. Assign participants to meaningful boundaries.
6. Add ordered interactions in a table.
7. Reorder interactions and edit their semantics.
8. See architecture and sequence previews update automatically.
9. Switch among current, target, and transition previews when applicable.
10. Review plain-language consistency and readability checks.
11. Edit and play a short walkthrough of the scenario.
12. Export the generated graph document and self-contained SVGs.

No step in this journey may require editing source code or JSON.

## Information architecture

Use this lightweight hierarchy:

```text
Workspace
├── Participant catalog
└── Scenarios
    ├── Overview
    ├── Participants and boundaries
    ├── Interactions
    ├── Diagram preview
    ├── Walkthrough
    └── Architecture checks
```

For the alpha, one local workspace is enough. Multi-tenant organizations, permissions, approval workflows, and server synchronization are out of scope.

## Authoring domain model

Keep this model independent of PR Lens types. Exact names may be adjusted to match the project, but preserve the separation of concerns.

### Workspace

- `id`
- `name`
- `participants[]`
- `scenarios[]`

### Participant

- Stable internal `id`
- `name`
- `type`: actor, application, service, API gateway, integration platform, event broker, queue, datastore, SaaS, external organization, or other
- Optional `description`
- Optional `domain`
- Optional `owner`
- Optional `location`
- Optional `trustZone`
- Optional `lifecycle`

### Boundary

- Stable internal `id`
- `name`
- Optional `subtitle`
- Classification dimension: business domain, platform, trust zone, ownership, deployment location, or custom
- Display order

A scenario should use one primary boundary dimension at a time. Warn when its peer boundaries appear to mix dimensions, but do not block the user.

### Scenario

- Stable internal `id`
- `name`
- `businessOutcome`
- `trigger`
- `completionOutcome`
- `mode`: current, target, or transition
- `boundaries[]`
- `participantPlacements[]`
- `interactions[]`
- `walkthroughSteps[]`

### Participant placement

- `participantId`
- `boundaryId`
- Presence in current state
- Presence in target state
- Whether its responsibilities or implementation change
- Optional display subtitle
- Optional badges

### Interaction

- Stable internal `id`
- Ordered position
- `fromParticipantId`
- `toParticipantId`
- Short action label
- Pattern: synchronous request, asynchronous message, return, self-action, data access, dependency, or other
- Optional protocol or technology
- Optional payload or event name
- Optional frequency or repeat count
- Optional volume
- Optional latency or SLA
- Optional authentication
- Optional data classification
- Optional timeout, retry, or idempotency notes
- Optional failure or compensation notes
- Presence in current state
- Presence in target state
- Whether its behavior or implementation changes
- Whether traffic should be animated
- Whether it is the scenario's principal or “hero” interaction

### Walkthrough step

- Stable internal `id`
- Short heading
- One-sentence explanation
- Diagram stage: architecture overview or sequence flow
- Focused participant and interaction IDs
- Ordered position

## Compiling to PR Lens

Use `@coldtea/pr-lens-schema` and `@coldtea/pr-lens-renderer` if they are compatible with the project. Treat them as third-party dependencies, not as code this project is expected to modify or contribute back. If consuming the packages is impractical, isolate a small adapter so the renderer can be substituted without changing the authoring model.

The adapter must be a pure, unit-tested transformation:

```text
Authoring scenario + selected state
  → PR Lens graph document
  → schema validation
  → rendered SVG + atlas
```

Apply these mappings:

| Studio concept | PR Lens concept |
|---|---|
| Boundary | Lane |
| Participant | Node |
| Structural interaction | Edge |
| Ordered scenario | Flow |
| Interaction row | Flow message |
| Current/target difference | Delta |
| Preview section | View |
| Storyboard card | Walkthrough step |

Generate stable, readable IDs internally. Never derive identity solely from a mutable display name.

Map current/target presence to deltas:

| Current | Target | Changed | Delta |
|---|---|---|---|
| No | Yes | — | `added` |
| Yes | No | — | `removed` |
| Yes | Yes | Yes | `modified` |
| Yes | Yes | No | `unchanged` |

For a current-only or target-only scenario, render all included elements as `unchanged` unless the user explicitly marks a change. For a transition scenario, produce the full change visualization.

Participant types should map to the closest available PR Lens node kind. Preserve more specific enterprise terminology in labels, subtitles, and the Studio domain model. Interaction patterns should map to the closest edge and message kinds. Protocol, payload, volume, or frequency can be folded into concise labels for the alpha.

Produce at least two views:

- An architecture overview containing the scenario's participants and structural interactions.
- A data-flow view containing its ordered flow.

Generate a valid default walkthrough from the interaction sequence, but let the user edit, reorder, delete, and focus its steps. Keep walkthrough headings and body text within PR Lens constraints.

Catch schema errors inside the adapter. Never expose Zod paths or graph terminology directly to the user.

## Primary screens

### 1. Scenario home

Show:

- Product name and a short explanation
- “Create scenario” primary action
- A seeded “Order to SAP” example that demonstrates sync, async, return, current/target change, and animation
- Existing locally saved scenarios
- Access to the participant catalog

### 2. Scenario setup

Use a compact guided form rather than a long wizard. Capture:

- Scenario name
- Business outcome
- Trigger
- Completion outcome
- Current, target, or transition mode

Let the user proceed with only the required fields and refine later.

### 3. Scenario workbench

Use a three-region desktop layout:

```text
┌──────────────────┬────────────────────────────────┬──────────────────┐
│ Scenario outline │ Live diagram preview           │ Selected item    │
│                  │                                │ inspector        │
│ Overview         │ Architecture / Sequence        │                  │
│ Participants     │ Current / Target / Transition  │ Semantic fields  │
│ Interactions     │                                │ for the selected │
│ Walkthrough      │ Play / pause / restart         │ participant or   │
│ Checks           │                                │ interaction      │
└──────────────────┴────────────────────────────────┴──────────────────┘
```

On narrower desktop widths, the inspector may become a drawer. Mobile authoring is not required, but the application must fail gracefully rather than overlap or clip controls.

### 4. Participant and boundary editor

Provide:

- Boundary cards or sections
- Searchable participant picker from the catalog
- Inline participant creation
- Reassignment between boundaries
- Current/target presence controls
- Duplicate-name warning

Do not turn this into a freeform drawing canvas.

### 5. Interaction table

This is the primary editing experience. Required visible columns:

- Order
- From
- Action
- To
- Pattern
- Technology
- State

Support:

- Inline editing
- Row creation and deletion
- Drag or keyboard reordering
- Duplicate row
- Selection that opens the inspector
- Clear missing-field states
- A compact animation toggle
- A single hero-interaction selection

Keep advanced operational fields in the inspector so the table remains readable.

### 6. Diagram preview

Provide tabs for Architecture and Sequence and, for transition scenarios, controls for Current, Target, and Transition.

The preview should:

- Render the self-contained PR Lens SVG
- Update after valid semantic edits
- Preserve the last valid preview while a row is temporarily incomplete
- Explain why a preview cannot update
- Offer play, pause, and restart controls where technically possible
- Respect reduced-motion preferences by defaulting to a static presentation
- Allow selection of a rendered participant or interaction when the atlas makes it practical

Do not require users to manipulate SVG paths or edge routing.

### 7. Walkthrough editor

Represent the walkthrough as reorderable storyboard cards. Each card shows its heading, explanation, chosen stage, and focused elements. Include a play-through mode that advances cards and visibly focuses the corresponding diagram elements using the render atlas.

### 8. Architecture checks

Present validation as architectural questions grouped by severity:

- Incomplete description
- Internal inconsistency
- Diagram readability
- Advisory recommendation

Examples:

- “SAP receives step 4 but is not included as a participant.”
- “Payment Service is outside every boundary.”
- “This scenario uses seven boundaries and may be difficult to read.”
- “The target removes the ESB, but two target interactions still use it.”
- “OrderConfirmed has no apparent producer.”
- “This synchronous request has no return, timeout, or failure behavior.”

Checks should link back to the participant or interaction that needs attention.

## Persistence and import/export

Use browser-local persistence for the alpha. Prefer IndexedDB if the project already has a suitable abstraction; otherwise a versioned local-storage representation is acceptable. Include an obvious way to reset the seeded data.

Export:

- Studio scenario JSON, suitable for re-import without losing enterprise metadata
- Generated PR Lens graph JSON
- Light and dark standalone SVGs

Import at minimum:

- Previously exported Studio scenario JSON
- A simple CSV interaction list, if it can be added without compromising the core vertical slice

Design future importers—OpenAPI, AsyncAPI, ArchiMate, draw.io, cloud inventories, and prose extraction—as adapters. Do not implement them in the alpha.

## Interaction and visual direction

The product should feel like a professional architecture workbench, not a developer IDE and not a generic whiteboard.

- Favor calm neutral surfaces, crisp hierarchy, and high information density without crowding.
- Use ordinary product controls and clear labels.
- Avoid terminal motifs, code fonts as the primary typeface, raw JSON panels, neon “AI” styling, and decorative dashboard metrics.
- Make the animated diagram the visual center of the workbench.
- Use color consistently for current/target changes, but never rely on color alone.
- Ensure every control has a visible label or accessible name and a useful keyboard focus state.

If the project has an existing design system, use it. Otherwise establish a small token set for spacing, color, type, borders, and elevation rather than scattering literal values through components.

## Plain-language error policy

Maintain a translation layer from internal validation failures to user-facing messages. Messages must say:

1. What cannot currently be shown or saved.
2. Which participant or interaction caused it.
3. What the architect should change.

For example, translate an unknown message endpoint into:

> “The ‘Publish order’ interaction refers to a participant that has been removed. Choose a new destination or delete the interaction.”

Do not show stack traces, schema paths, package names, or validation-library terminology in the normal interface.

## Non-goals for the alpha

- General-purpose diagram drawing
- Arbitrary manual node positioning or edge routing
- Enterprise-wide landscape maps
- Multi-user editing, comments, approvals, or permissions
- Server accounts or cloud synchronization
- Live repository analysis
- AI-provider integration
- Automatic discovery from infrastructure
- Full ArchiMate or BPMN modeling
- Policy-engine integration
- Production-grade architecture repository governance

## Acceptance criteria

The alpha is complete when all of the following are true:

1. A non-coding user can create a scenario, participants, boundaries, and a five-step interaction flow entirely through the UI.
2. Reordering table rows changes sequence order and animation order.
3. Editing a participant or interaction updates both architecture and sequence previews.
4. A transition scenario correctly derives added, modified, removed, and unchanged elements.
5. The user can switch between current, target, and transition presentations.
6. The generated PR Lens document validates before rendering.
7. The UI never requires or exposes graph JSON during normal authoring.
8. An incomplete edit does not destroy the last valid preview.
9. At least five useful consistency or readability checks are implemented with plain-language messages.
10. A generated walkthrough can be edited, reordered, and played.
11. The seeded “Order to SAP” scenario demonstrates the entire journey.
12. Studio JSON, graph JSON, and standalone SVGs can be exported.
13. Saved scenarios survive a page reload.
14. Core authoring actions are keyboard accessible.
15. Reduced-motion users can view a non-animated representation.
16. Unit tests cover state-to-delta mapping, interaction-to-message mapping, stable IDs, validation translation, and compilation of the seeded scenario.
17. At least one end-to-end or integration test covers creating or editing a scenario and receiving a valid preview.
18. The project builds, typechecks, and tests successfully using its normal commands.

## Suggested implementation sequence

### Milestone 1: Walking skeleton

- Establish the authoring types and local data store.
- Seed the Order-to-SAP example.
- Compile it to a valid PR Lens graph.
- Render architecture and sequence SVGs.
- Show them in a minimal scenario page.

Verify the domain-to-renderer path before investing in editing UI.

### Milestone 2: Core authoring

- Scenario setup form
- Participant and boundary editing
- Interaction table and inspector
- Live preview with last-valid behavior
- Local persistence

### Milestone 3: Transition story

- Current/target presence controls
- Derived delta logic
- Current, target, and transition previews
- Architecture checks

### Milestone 4: Explanation and handoff

- Generated and editable walkthrough
- Atlas-based focus where practical
- Export and re-import
- Accessibility and reduced-motion pass
- Tests and concise project documentation

## Engineering expectations

- Keep the PR Lens adapter isolated from UI components.
- Prefer pure functions for compilation and architectural checks.
- Validate persisted and imported data at the boundary.
- Avoid a global state framework unless the existing project already uses one or complexity clearly warrants it.
- Keep sample data realistic but fictional and free of sensitive information.
- Do not add a backend merely to support the alpha.
- Record material assumptions and known limitations in the project README.
- When PR Lens cannot express enterprise metadata, retain that metadata in the Studio model and make a deliberate lossy mapping for presentation. Do not distort the authoring model to fit the renderer.

## Product decisions to preserve

These decisions are intentional and should not be silently changed during implementation:

- The project is inspired by PR Lens but is independent of it; upstream merger is not a goal.
- The interaction table is the primary authoring surface.
- The diagram is a preview and semantic correction surface, not a freeform canvas.
- Stable IDs are generated and hidden from ordinary users.
- The Studio model is the saved source of truth; PR Lens is compiled output.
- The core product works without an AI service.
- The first release is local-first and single-user.
- The alpha optimizes for one focused integration scenario at a time, not an enterprise-wide landscape.

If a technical constraint makes one of these decisions impractical, document the constraint and implement the smallest compatible alternative rather than expanding scope.
