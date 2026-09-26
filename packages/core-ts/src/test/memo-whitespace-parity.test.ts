// Memo whitespace / leading-zero parity suite.
//
// The same table is asserted in core-go (routing/memo_whitespace_parity_test.go)
// and core-dart (test/memo_whitespace_parity_test.dart) so that MEMO_TEXT
// normalization is identical in all three SDKs.
import { describe, it, expect } from "vitest";
import { normalizeMemoTextId } from "../routing/memo";

// [input, normalized (null = unroutable), warning original/normalized or null]
const cases: [string, string | null, [string, string] | null][] = [
  [" 123 ", null, null],
  [" 123", null, null],
  ["123 ", null, null],
  ["123\n", null, null],
  ["\t123", null, null],
  ["1 23", null, null],
  ["", null, null],
  ["00123", "123", ["00123", "123"]],
  ["000", "0", ["000", "0"]],
  ["0", "0", null],
  ["123", "123", null],
];

describe("normalizeMemoTextId whitespace/leading-zero parity", () => {
  for (const [input, normalized, warning] of cases) {
    it(`handles ${JSON.stringify(input)}`, () => {
      const r = normalizeMemoTextId(input);
      expect(r.normalized).toBe(normalized);
      if (warning === null) {
        expect(r.warnings).toHaveLength(0);
      } else {
        expect(r.warnings).toHaveLength(1);
        expect(r.warnings[0].code).toBe("NON_CANONICAL_ROUTING_ID");
        expect(r.warnings[0].normalization).toEqual({
          original: warning[0],
          normalized: warning[1],
        });
      }
    });
  }
});
