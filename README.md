# Integration Scenario Studio

A local-first alpha workbench for enterprise integration architects. Author a business scenario through participants, boundaries, and an ordered interaction table; explore the compiled architecture and animated sequence; explain the change through a walkthrough.

This is an independent experiment inspired by PR Lens, not a fork or an upstream contribution. It consumes the published `@coldtea/pr-lens-schema` 0.2.1 and `@coldtea/pr-lens-renderer` 0.2.2 packages. No AI service, backend, account, or API key is required.

## Run locally

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Start with **Order to SAP**, or choose **Create scenario**. To serve a production build, run `npm run build` and `npx vite preview`.

```sh
npm run typecheck
npm test
npm run build
```

The application is intentionally local-only. It is not registered with a hosting service and does not synchronize browser data. After installation, the application has no external runtime requests, including web fonts.

## Try the complete journey

1. Open **Order to SAP**. The example shows synchronous requests, asynchronous messages, returns, a principal interaction, and added / modified / removed / unchanged elements.
2. Switch **Architecture / Sequence** and **Current / Target / Transition**. Pause or restart traffic. Enlarge the diagram when labels need more room.
3. Use **Quick capture** in **Interactions**: enter one action or paste one action per line, then press Enter (Shift+Enter adds a line). **Add participants now** enables optional searchable sender/receiver fields, inline participant creation, and an explicit suggestion to continue from the previous receiver. Captured steps save immediately with an unspecified pattern. **Complete details** opens the first unfinished step; choose its participants and pattern, then use **Next unfinished step**. The inspector also offers reply, onward-message and internal-action shortcuts.
4. Edit an action in the table; choose **Show detail columns** for technology, pattern, state and traffic. Use the up/down controls to reorder; duplicate or delete rows; select the star to choose the one principal interaction.
5. Choose **Participants** to create a participant inline or add one from the searchable catalog. Add boundaries and select a participant to assign it to a boundary, edit shared catalog details, or change state presence.
6. Clear an action temporarily. The previous valid preview remains, with a message explaining the incomplete edit. Drafts continue to save.
7. Open **Checks**. Follow a question back to the relevant editor. Complete descriptions and operational details in the inspector.
8. Open **Walkthrough** to edit headings, explanations, stages and focus. Reorder cards, choose one directly, or play through them at five-second intervals. Regenerating cards asks before replacing existing work.
9. **Export** either view as a light/dark standalone SVG, or an editable Studio scenario. Import the Studio file from the home screen to create an independent copy. **Export all diagrams** downloads a single ZIP: in a scenario it includes both views in the selected presentation, in light and dark themes; from the workspace header it includes every scenario using its own mode. Numbered scenario folders prevent filename collisions. Unavailable diagrams are listed in the dialog and `EXPORT-NOTES.txt`; an empty archive is never downloaded.

## Authoring and persistence

The Studio model is the saved source of truth. Mutable display names never determine identity. Array order determines interaction, boundary and walkthrough presentation order. Boundary order fields are also maintained by the editor.

A versioned workspace is saved under `integration-scenario-studio.v1` in local storage. All stored/imported shapes are validated at the boundary, including ID uniqueness and a single principal interaction. Draft semantic inconsistencies remain editable and saveable. A corrupt/unsupported saved workspace is preserved, saving is paused, and the UI offers the original data for download before reset. Save failures are displayed rather than silently reporting success. Normal saves are debounced by 350 ms, with a page-hide flush.

To start from scratch, choose **Clear workspace** on the home screen and confirm. This removes all scenarios and catalog participants; the empty workspace persists across reloads. You can create or import a scenario immediately, or restore the sample using **Reset workspace to seeded example**.

Export regularly: clearing site data, switching browsers, changing the app's origin/port, or private browsing can remove or isolate your workspace. Export/import preserves the supported enterprise fields, presence, badges, operational notes, and walkthrough. Import remaps participant and scenario IDs so editing an imported copy cannot inadvertently change the existing catalog.

A CSV import appends interactions without replacing the existing list. Required headings are `From,Action,To`; optional headings are `Pattern,Technology`. Participant names must match exactly one catalog participant (case-insensitive). Quoted commas, line breaks, and escaped quotation marks are supported. The import dialog includes a downloadable example. Unsupported files produce a plain-language error and leave the workspace unchanged.

## Architecture

- `src/domain/model.ts`: independent Studio types, boundary schemas, constructors, reordering and default walkthrough generation.
- `src/domain/seed.ts`: fictional Order to SAP transition scenario.
- `src/domain/checks.ts`: pure consistency/readability checks grouped by severity.
- `src/domain/storage.ts`: versioned local persistence, validated imports, CSV parsing and exports.
- `src/domain/importers.ts`: future importer proposal interface; external importers remain out of scope.
- `src/adapter/compiler.ts`: pure Studio-to-PR-Lens compilation, schema and reference validation, plain-language validation translation and rendering entry point.
- `src/adapter/architecture-timing.ts`: replaces independent architecture pulses with a shared, ordered story clock in both previews and standalone exports.
- `src/adapter/browser-crypto.ts`: narrow SHA-256 shim for the renderer's Node crypto import. Uses `@noble/hashes`; installed packages are unchanged.
- `src/components`: workbench surfaces, last-valid preview cache, atlas-based selection/focus, participant and interaction editors.

Compilation checks the authoring model before calling PR Lens's `safeParseGraphDoc`, which validates both shape and reference integrity. Only valid documents reach rendering. Newly captured interactions carry a backward-compatible `draft` flag (absent in older exports means false). Incomplete captured steps are excluded from compilation until action, sender, receiver and pattern are supplied. Their original table positions and unfinished status are shown explicitly above the partial preview. Established non-draft interactions retain last-valid preview protection during incomplete edits. State projections filter presence; transition deltas are derived from current/target presence and the changed flag. Single-state scenarios use unchanged unless explicitly marked changed. When viewing a current or target projection of a transition scenario, change badges retain their transition meaning.

PR Lens's mandatory repository provenance is populated with explicit local placeholder values (`local/integration-scenario-studio`, zero revision IDs). These do not refer to a real repository or commit. Studio does not generate source links or present provenance during authoring.

Participant enterprise types map to the closest renderer kind, with the original type retained in the Studio model and display subtitle. Action, technology and payload map to bounded presentation labels; numeric frequency maps to message repeat. All operational data remains in Studio exports even when the diagram cannot express it. An architecture interaction maps to a stable `edge-` identifier and a flow interaction to a stable `message-` identifier. Layout uses stable participant order and rank hints, not display names or manual positioning.

## Alpha scope and limits

All four milestones in `product-brief.md` are implemented: walking skeleton, core authoring, transition story, and explanation/handoff.

- Desktop authoring is primary. On narrower screens the inspector becomes a closable drawer, navigation wraps into a horizontal strip, and wide tables/diagrams scroll within their regions. Mobile authoring is not optimized.
- Native keyboard controls support editing, selection, row/card/boundary reordering, dialogs and navigation. Atlas regions are keyboard-selectable and named. Focus rings and text/symbol change labels supplement color.
- Reduced-motion preferences default traffic to a static presentation. Standard playback uses self-contained SVG animation and the browser's SVG timeline controls. Architecture traffic follows table order, with one active crossing at a time (1.4 seconds each), and skips disabled traffic. Numeric repeats produce up to three consecutive crossings. This expresses narrative order, not a latency simulation or a claim that asynchronous work cannot overlap. In Transition, both alternative paths follow their table positions; Current and Target isolate each state. Studio adapts the pinned renderer's generated edge/pulse markup and tests this compatibility contract; sequence timing remains supplied by PR Lens. Static mode also hides traffic markers as a fallback. Walkthrough auto-advance only starts on explicit request.
- The published sequence schema requires 2–12 participants and 1–64 interactions. Architecture can begin with one participant; a sequence appears when its minimum is met. The renderer supports at most 16 boundaries. Checks explain these limits. A single-participant self-action can be represented in architecture, but cannot form a sequence alone.
- Walkthroughs support up to 12 cards, 48-character headings and 140-character explanations. The Studio UI can retain one card, but the compiled PR Lens document includes a walkthrough only with at least two complete, applicable cards. Focused cards wholly absent from a selected state are omitted from that compiled document; Studio retains them.
- Renaming preserves identifiers and stable rank hints. Renderer-owned routing can still adjust when structure, text dimensions, boundaries, or included participants change.
- A held preview states which presentation it shows. Individual SVG exports are disabled for invalid or partially resolved stories, so a stale or incomplete diagram is never mislabeled as a full export. Bulk ZIP exports may include resolved steps, with omitted positions recorded in the dialog and export notes. Studio exports remain available.
- Undo retains the last 40 editing snapshots for the current session. It is not a revision history.
- The core alpha works without code/JSON authoring. Advanced importers, AI extraction, synchronization, authentication, governance, and manual drawing are intentionally absent.

## Verification

The test suite covers delta mapping, every interaction-to-message pattern, stable identities, seeded compilation/schema validation and both SVG views in all three states and themes, ordering, SVG text escaping, SHA-256 compatibility, validation translation, draft persistence, corrupt-data protection, isolated round trips, CSV handling, and architectural checks.

React integration tests use the real compiler and renderer. They create a new scenario with two participants and five interactions through the UI, generate/focus its walkthrough, edit and reorder the seed, switch states, verify last-valid preview preservation, reload saved state, and verify reduced-motion defaults. These are DOM integration tests, not a full browser visual regression suite.

## Third-party notices

PR Lens and other bundled dependencies retain their licenses in `THIRD_PARTY_NOTICES.txt`. A copy is included in production output at `/third-party-notices.txt`. Studio source was independently developed; third-party package code was not copied into it.
