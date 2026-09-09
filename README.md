# Integration Scenario Studio

Create standalone HTML pages with animated SVG diagrams that explain how systems interact. Share the exported files with anyone: the HTML pages open directly in a browser, work offline, and require no server or access to Studio.

Use Studio to describe the participants, the requests and messages they exchange, then export architecture and sequence views. To illustrate future changes, you can model the current and target states and export pages that let the viewer switch between current, target, and change views.

You run the server locally, then use the browser app which saves your work locally. There is no need to deploy anything and no database.

## Export and share

Use **Export** to download the diagram you're viewing as an HTML page or SVG. Send the HTML file to someone and they can open it in their browser. Use the SVG in a document, presentation, or web page.

Choose **Export → Download PowerPoint** for a single `.pptx` containing an architecture overview, one slide per walkthrough card, and separate architecture and sequence animation slides (when those views are available). Each animation is an embedded H.264 MP4, so the recipient can copy the walkthrough slides or the video slides into another deck and present offline. The export uses the selected presentation state and current light/dark appearance. Slide headings and explanations are editable; static diagrams are embedded SVGs with the card's focus highlighted, plus PNG fallbacks for viewers without SVG support. SVGs retain sharp lines and text when scaled; animation slides remain raster MP4 video.

PowerPoint export runs locally in your browser. Keep Studio open while the progress indicator runs, or choose **Cancel PowerPoint export**. No add-in, online viewer, or separate video file is required to present the result. Complete unfinished interactions and walkthrough cards before exporting; cards that refer to content missing from the selected state must be updated or exported in a state that includes that content. Without walkthrough cards, the deck contains the available diagram overviews and animation slides. Videos follow one full traffic cycle; if traffic animation is disabled, that view's video remains still.

To share a whole scenario, choose **Export all diagrams**. You'll get a ZIP with architecture and sequence views for each available state, in light and dark themes. Unzip it and open `index.html` to browse the diagrams. The viewer lets you switch views, states, and themes without Studio. Choose the same export from the workspace header to include all your scenarios.

If a scenario is incomplete, some steps or diagrams may be left out of the ZIP. You can see what's missing in the export dialog and in `EXPORT-NOTES.txt`.

## Run locally

You'll need Node.js 22 or later and npm. Install the dependencies and start the local server:

```sh
npm ci
npm run dev
```

Open the address printed in your terminal. Choose **Order to SAP** to try the example, or **Create scenario** to start your own.

To build and preview the production version:

```sh
npm run build
npm run preview
```

## Build a scenario

Add your systems under **Participants**, then open **Interactions** to describe what happens between them. In **Quick capture**, type or paste one action per line. You can get the steps down first and fill in the senders, receivers, and interaction patterns later. Move rows up or down to change the order.

Switch to **Architecture** to see how the systems connect, or **Sequence** to follow their exchanges in order. The animation follows the steps you've written; it doesn't simulate how long the systems take to respond.

Open **Checks** for help finding missing details and inconsistencies. If a step isn't ready to draw, the preview explains whether it has left that step out or is still showing the last valid diagram.

To describe a planned change, use **Current** for how things work today and **Target** for how they should work. **Transition** shows the changes between them. You can choose which state to edit separately from the diagram, using **Current / Target / Compare** in the interaction editor.

If your target is empty, **Populate target from current** gives you a starting point. Target fields follow the current values until you edit them. Reset a target field to have it follow the current value again. Deleting or reordering an interaction shared by both states changes both.

Use **Walkthrough** to explain the diagram a piece at a time. Add cards with headings and short descriptions, and choose the part of the diagram each card focuses on.

You can also add interactions from a CSV file. Use the column headings `From,Action,To`, and include `Pattern` and `Technology` if you have them. Sender and receiver names must match participants in your catalog; capitalization doesn't matter. Download the example from the import dialog to see the format.

## Save your work

Studio saves your edits in your browser as you work. Use **Export → Studio scenario** to save a complete editable backup as a `.studio.json` file. **Import scenario** restores boundary orientation, participant order, display hints (including **Stretch to fill**), subtitles, badges, interactions, and walkthroughs. CSV import adds interaction rows only; use the JSON scenario file to move the complete scenario between workspaces.

## Limits

- Sequence diagrams need 2–12 participants and 1–64 interactions. Architecture diagrams can start with one participant. You can use up to 16 boundaries.
- A walkthrough can have up to 12 cards. Headings are limited to 48 characters and explanations to 140.
- You can undo the last 40 edits during the current session.
- Studio places the participants and routes the connections automatically. You can't drag them into position.

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

Unit tests cover compilation, state mapping, storage, imports, and exports. React integration tests check editing and previews using the real compiler and renderer. The tests run in a simulated DOM, so you'll still need to check the layout in a browser.

## License

[MIT](LICENSE). Dependency licenses are listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), also included in production builds at `/third-party-notices.txt`.
