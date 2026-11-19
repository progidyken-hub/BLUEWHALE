import { describe, it, expect } from "vitest";
import { vectors, encodeMuxed, decodeMuxed } from "./vectorHarness";

// Each module's vector cases live in their own test file so vitest runs them
// in parallel worker threads across CPU cores (issue #452). The cases within
// a file are declared concurrent so the scheduler overlaps them.
describe.concurrent("Normative Vector Tests — muxed", () => {
  vectors.cases
    .filter((c: any) => c.module === "muxed_encode")
    .forEach((c: any) => {
      it.concurrent(`[${c.module}] ${c.description}`, () => {
        const baseG = c.input.base_g ?? c.input.gAddress;
        const mAddress = encodeMuxed(baseG, BigInt(c.input.id));
        expect(mAddress).toBe(c.expected.mAddress);
      });
    });

  vectors.cases
    .filter((c: any) => c.module === "muxed_decode")
    .forEach((c: any) => {
      it.concurrent(`[${c.module}] ${c.description}`, () => {
        if (c.expected.expected_error) {
          expect(() => decodeMuxed(c.input.mAddress)).toThrow();
        } else {
          const result = decodeMuxed(c.input.mAddress);
          expect(result.baseG).toBe(c.expected.base_g);
          expect(result.id).toBe(BigInt(c.expected.id));
        }
      });
    });
});
