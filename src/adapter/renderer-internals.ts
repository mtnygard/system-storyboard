/**
 * Isolate the private geometry/painter APIs used by the platform layout.
 * These imports target the pinned PR Lens renderer 0.2.2; geometry regression
 * tests must pass before upgrading that dependency. Its MIT notice is included
 * in THIRD_PARTY_NOTICES.txt.
 */
export {
  layoutArchitecture,
  badgeRow,
  type ArchitectureLayout,
  type GapExpansions,
  type PlacedLane,
  type PlacedNode,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/layout/architecture.js";
export {
  routeEdges,
  channelTraffic,
  curveBounds,
  type RoutedEdge,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/layout/edges.js";
export { placeLabelPills } from "../../node_modules/@coldtea/pr-lens-renderer/dist/layout/labels.js";
export {
  paintCard,
  paintLabelPill,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/svg/architecture.js";
export {
  svgDocument,
  shifted,
  markerFor,
  toneFor,
  toneColour,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/svg/document.js";
export { travellingPulses } from "../../node_modules/@coldtea/pr-lens-renderer/dist/svg/pulse.js";
export {
  tag,
  textNode,
  wrap,
  lines,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/svg/primitives.js";
export { atlasBoxes } from "../../node_modules/@coldtea/pr-lens-renderer/dist/atlas.js";
export {
  canvasFor,
  union,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/bounds.js";
export {
  DIAGRAM_MARGIN,
  LANE_TOP,
  CONTENT_TOP,
  LANE_HEADER_BASELINE,
  LANE_PADDING_X,
  LANE_GAP,
  LANE_BOTTOM_PADDING,
  LANE_RADIUS,
  ROW_GAP,
  TRACK_CLEARANCE,
  TRACK_PITCH_MIN,
} from "../../node_modules/@coldtea/pr-lens-renderer/dist/design.js";
export { measure } from "../../node_modules/@coldtea/pr-lens-renderer/dist/text.js";
