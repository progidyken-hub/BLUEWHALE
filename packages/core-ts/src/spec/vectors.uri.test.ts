import { describe, it, expect } from "vitest";
import {
  vectors,
  extractRoutingFromURI,
  normalizeRoutingId,
  normalizeExpectedBaseAccount,
} from "./vectorHarness";

// Each module's vector cases live in their own test file so vitest runs them
// in parallel worker threads across CPU cores (issue #452). The cases within
// a file are declared concurrent so the scheduler overlaps them.
describe.concurrent("Normative Vector Tests — extract_from_uri", () => {
  vectors.cases
    .filter((c: any) => c.module === "extract_from_uri")
    .forEach((c: any) => {
      it.concurrent(`[${c.module}] ${c.description}`, () => {
        const result = extractRoutingFromURI(c.input.uri);
        expect(result.success).toBe(c.expected.success);
        if (c.expected.success && result.success) {
          expect(result.routing.destinationBaseAccount).toBe(
            normalizeExpectedBaseAccount(c.expected.routing.destinationBaseAccount)
          );
          expect(normalizeRoutingId(result.routing.routingId)).toBe(
            normalizeRoutingId(c.expected.routing.routingId)
          );
          expect(result.routing.routingSource).toBe(
            c.expected.routing.routingSource
          );
          expect(result.routing.warnings).toEqual(c.expected.routing.warnings);
        } else if (!c.expected.success && !result.success) {
          expect(result.code).toBe(c.expected.code);
        }
      });
    });
});
