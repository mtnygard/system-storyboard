import {
  ParticipantSchema,
  InteractionSchema,
  generateWalkthrough,
  type Workspace,
  type Scenario,
} from "./model";
export function seedWorkspace(): Workspace {
  const participants = [
    ["p-customer", "Customer", "actor", "Commerce"],
    ["p-store", "Order Portal", "application", "Commerce"],
    ["p-esb", "Legacy ESB", "integration platform", "Integration"],
    ["p-events", "Order Events", "event broker", "Integration"],
    ["p-service", "Order Service", "service", "Integration"],
    ["p-sap", "SAP S/4HANA", "application", "Operations"],
  ].map(([id, name, type, domain]) =>
    ParticipantSchema.parse({
      id,
      name,
      type,
      domain,
      owner: domain + " team",
    }),
  );
  const s: Scenario = {
    id: "s-order-sap",
    name: "Order to SAP",
    businessOutcome:
      "Accept customer orders quickly while moving fulfillment to an event-driven integration.",
    trigger: "A customer submits an order in the Order Portal.",
    completionOutcome:
      "SAP creates a sales order and the customer receives confirmation.",
    mode: "transition",
    boundaries: [
      {
        id: "b-commerce",
        name: "Commerce",
        subtitle: "Customer experience",
        dimension: "business domain",
        order: 0,
      },
      {
        id: "b-integration",
        name: "Integration",
        subtitle: "Orchestration & messaging",
        dimension: "business domain",
        order: 1,
      },
      {
        id: "b-operations",
        name: "Operations",
        subtitle: "System of record",
        dimension: "business domain",
        order: 2,
      },
    ],
    participantPlacements: participants.map((p) => ({
      participantId: p.id,
      boundaryId:
        p.domain === "Commerce"
          ? "b-commerce"
          : p.domain === "Integration"
            ? "b-integration"
            : "b-operations",
      current: !["p-events", "p-service"].includes(p.id),
      target: p.id !== "p-esb",
      changed: p.id === "p-store",
      subtitle: p.type,
      badges: [],
    })),
    interactions: [],
    walkthroughSteps: [],
  };
  const add = (
    id: string,
    from: string,
    to: string,
    action: string,
    pattern: string,
    technology: string,
    current = true,
    target = true,
    extra = {},
  ) =>
    s.interactions.push(
      InteractionSchema.parse({
        id,
        fromParticipantId: from,
        toParticipantId: to,
        action,
        pattern,
        technology,
        current,
        target,
        changed: false,
        animated: true,
        hero: false,
        ...extra,
      }),
    );
  add(
    "i-submit",
    "p-customer",
    "p-store",
    "Submit order",
    "synchronous request",
    "HTTPS",
    true,
    true,
    {
      payload: "Sales order",
      authentication: "Customer session",
      resilience: "Timeout after 10 seconds; safe to retry with order key.",
    },
  );
  add(
    "i-legacy",
    "p-store",
    "p-esb",
    "Forward order",
    "synchronous request",
    "SOAP",
    true,
    false,
    { resilience: "Timeout after 30 seconds." },
  );
  add(
    "i-legacy-sap",
    "p-esb",
    "p-sap",
    "Create sales order",
    "synchronous request",
    "RFC",
    true,
    false,
    { resilience: "Retry once; reconcile by external order ID." },
  );
  add(
    "i-publish",
    "p-store",
    "p-events",
    "Publish order",
    "asynchronous message",
    "AMQP",
    false,
    true,
    {
      payload: "OrderSubmitted",
      hero: true,
      volume: "2,000 orders / hour",
      authentication: "mTLS",
      dataClassification: "Confidential",
      resilience: "Outbox delivery; deduplicate by order ID.",
    },
  );
  add(
    "i-consume",
    "p-events",
    "p-service",
    "Deliver order",
    "asynchronous message",
    "AMQP",
    false,
    true,
    {
      payload: "OrderSubmitted",
      resilience: "Exponential retry; dead-letter after 5 attempts.",
    },
  );
  add(
    "i-create",
    "p-service",
    "p-sap",
    "Create sales order",
    "synchronous request",
    "OData",
    false,
    true,
    {
      payload: "SalesOrder",
      latency: "P95 < 2 seconds",
      resilience: "5-second timeout; idempotency key is order ID.",
      failure: "Queue for reconciliation when SAP is unavailable.",
    },
  );
  add(
    "i-return",
    "p-sap",
    "p-service",
    "Return order number",
    "return",
    "OData",
    false,
    true,
    { payload: "SalesOrderID" },
  );
  add(
    "i-confirm",
    "p-store",
    "p-customer",
    "Confirm acceptance",
    "return",
    "HTTPS",
    true,
    true,
    { changed: true, payload: "Order accepted; fulfillment pending" },
  );
  s.walkthroughSteps = generateWalkthrough(s, participants);
  return {
    version: 1,
    id: "workspace-local",
    name: "My architecture workspace",
    participants,
    scenarios: [s],
  };
}
