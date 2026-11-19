import { describe, it, expect } from "vitest";
import { vectors, detect } from "./vectorHarness";

// Each module's vector cases live in their own test file so vitest runs them
// in parallel worker threads across CPU cores (issue #452). The cases within
// a file are declared concurrent so the scheduler overlaps them.
describe.concurrent("Normative Vector Tests — detect", () => {
  vectors.cases
    .filter((c: any) => c.module === "detect")
    .forEach((c: any) => {
      it.concurrent(`[${c.module}] ${c.description}`, () => {
        const kind = detect(c.input.address);
        expect(kind).toBe(c.expected.kind);
      });
    });
});
