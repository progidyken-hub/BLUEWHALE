import { describe, it, expect } from "vitest";
import {
  vectors,
  extractRouting,
  normalizeRoutingId,
  normalizeVectorDestination,
  normalizeExpectedBaseAccount,
} from "./vectorHarness";

// Each module's vector cases live in their own test file so vitest runs them
// in parallel worker threads across CPU cores (issue #452). The cases within
// a file are declared concurrent so the scheduler overlaps them.
describe.concurrent("Normative Vector Tests — extract_routing", () => {
  vectors.cases
    .filter((c: any) => c.module === "extract_routing")
    .forEach((c: any) => {
      it.concurrent(`[${c.module}] ${c.description}`, () => {
        const input = c.input as any;
        const destination = normalizeVectorDestination(
          input.destination,
          c.expected.routingId
        );
        const routingInput = {
          destination,
          memoType: input.memoType,
          memoValue: input.memoValue || null,
          sourceAccount: input.sourceAccount || null,
        };

        const result = extractRouting(routingInput);
        expect(result.destinationBaseAccount).toBe(
          normalizeExpectedBaseAccount(c.expected.destinationBaseAccount)
        );
        expect(normalizeRoutingId(result.routingId)).toBe(
          normalizeRoutingId(c.expected.routingId)
        );
        expect(result.routingSource).toBe(c.expected.routingSource);
        expect(result.warnings).toEqual(c.expected.warnings);
      });
    });
});
