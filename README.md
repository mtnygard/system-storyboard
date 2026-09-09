# Integration Scenario Studio

Create standalone HTML pages with animated SVG diagrams that explain how systems interact. Share the exported files with anyone: the HTML pages open directly in a browser, work offline, and require no server or access to Studio.

In Studio, describe the participants and the requests and messages they exchange, then export architecture and sequence views. For a planned change, model the current and target states and export a comparison of the two.

The Studio runs in your browser and saves work locally. It needs no account, backend, or API key. This is an alpha, built primarily for desktop use.

## Export and share

The **Export** menu produces a standalone HTML page or an SVG of the selected diagram. HTML pages contain their diagrams and can be sent as files for recipients to open locally. SVGs can be used in documents, presentations, and other pages.

**Export all diagrams** creates a ZIP containing architecture and sequence views, available states, and both light and dark themes. Extract the ZIP and open `index.html` to browse the diagrams offline. The included interactive viewer lets readers switch views, states, and themes without Studio. From the workspace header, this export includes every scenario.

Incomplete scenarios may have fewer diagrams available to export. Bulk exports list omitted steps and unavailable diagrams in the dialog and in `EXPORT-NOTES.txt`.

## Run locally

Requires Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. Choose **Order to SAP** to explore the sample, or **Create scenario** to start your own.

To build and preview the production version:

```sh
npm run build
npm run preview
```

## Build a scenario

Add the systems involved under **Participants**, then open **Interactions** to describe what happens between them. **Quick capture** accepts one action per line, so you can sketch the steps before filling in senders, receivers, and interaction patterns. Reorder the rows to change the sequence.

The **Architecture** view shows connections between participants. The **Sequence** view shows the exchanges in order. Traffic animation follows the story; its timing does not represent system latency. **Checks** points out missing details and inconsistencies. While you edit an incomplete step, the preview either omits the draft or holds the last valid diagram and explains what it is showing.

For a transition scenario, switch between **Current**, **Target**, and **Transition** diagrams. The interaction editor has a separate **Current / Target / Compare** selector. **Populate target from current** copies the starting structure into an empty target. Target fields inherit current values until you edit them; resetting an override restores inheritance. Deleting or reordering shared interactions affects both states.

Use **Walkthrough** to add a guided explanation. Each card can focus on part of the diagram, with a heading and a short description.

You can also append interactions from a CSV file. Use the headings `From,Action,To`, with optional `Pattern,Technology` columns. Sender and receiver names must each match one catalog participant, ignoring case. The import dialog provides an example file.

## Save your work

Edits are automatically saved in browser local storage. Export a Studio scenario file to keep a backup.

## Limits

- Sequence diagrams require 2–12 participants and 1–64 interactions. Architecture diagrams can start with one participant. The renderer allows up to 16 boundaries.
- Walkthroughs allow up to 12 cards, with 48-character headings and 140-character explanations.
- Undo keeps the last 40 editing snapshots for the current session.
- Layout and routing are automatic; there is no manual positioning.
  
## Development

The app uses React, TypeScript, and Vite. PR Lens packages validate and render the diagrams.

| Location          | Contents                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| `src/domain/`     | Scenario model, state overrides, checks, persistence, and import handling |
| `src/adapter/`    | Compilation to PR Lens documents, animation timing, and diagram exports   |
| `src/components/` | Editors, previews, and walkthrough controls                               |
| `src/test/`       | Application integration tests                                             |

To check a change:

```sh
npm run typecheck
npm test
npm run build
```

Unit tests cover compilation, state mapping, storage, imports, and exports. React integration tests exercise editing and previews with the real compiler and renderer. These run in a simulated DOM; they do not check visual layout in a browser.

## License

[MIT](LICENSE). Dependency licenses are listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), also included in production builds at `/third-party-notices.txt`.
