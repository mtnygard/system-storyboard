import { expect, it } from "vitest";
import { newParticipant } from "./model";
import { parseCaptureLine } from "./quick-capture";

const catalog = [
  "Customer Portal",
  "Order Processing Service",
  "Processing Service",
  "Customer",
].map(newParticipant);
it.each([
  "Customer Portal calls Order Processing Service",
  '"Customer Portal" calls "Order Processing Service"',
  "“Customer Portal” calls “Order Processing Service”",
  "'Customer Portal' calls 'Order Processing Service'",
  "  customer portal   calls   ORDER PROCESSING SERVICE  ",
])("parses full catalog names in %s", (line) => {
  expect(parseCaptureLine(line, catalog)).toEqual({
    action: "calls",
    fromParticipantId: catalog[0].id,
    toParticipantId: catalog[1].id,
  });
});
it("keeps the action wording and supports self interactions", () => {
  expect(
    parseCaptureLine(
      "Customer Portal sends an order to Customer Portal",
      catalog,
    ),
  ).toEqual({
    action: "sends an order to",
    fromParticipantId: catalog[0].id,
    toParticipantId: catalog[0].id,
  });
});
it.each([
  "Check inventory",
  "Unknown calls Order Processing Service",
  "Customer Portal calls Unknown",
  "Customer Portal Order Processing Service",
])("preserves unmatched text: %s", (line) => {
  expect(parseCaptureLine(line, catalog)).toEqual({
    action: line,
    fromParticipantId: "",
    toParticipantId: "",
  });
});
it("reports duplicate names instead of selecting an arbitrary participant", () => {
  const parsed = parseCaptureLine(
    "Customer Portal calls Order Processing Service",
    [...catalog, newParticipant("order processing service")],
  );
  expect(parsed.error).toContain("More than one participant");
  expect(parsed.toParticipantId).toBe("");
});
it("treats punctuation in names literally", () => {
  const participants = ["API (v2)", "Store [EU]"].map(newParticipant);
  expect(
    parseCaptureLine("API (v2) calls Store [EU]", participants).action,
  ).toBe("calls");
});

it("does not match a participant name inside a larger word", () => {
  const line = "Customer Portals calls Order Processing Service";
  expect(parseCaptureLine(line, catalog.slice(0, 2))).toEqual({
    action: line,
    fromParticipantId: "",
    toParticipantId: "",
  });
});
