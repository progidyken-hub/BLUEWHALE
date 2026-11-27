/**
 * Shared vectors: spec/vectors/subaccount-formatting.json.
 *
 * uint64 subaccount (muxed) IDs must be formatted as plain decimal strings:
 * no exponent, no rounding, no leading zeros. JavaScript's reference
 * formatter is BigInt.prototype.toString(); Number#toString() is lossy above
 * 2^53 and must never be used.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { encodeMuxed } from "../muxed/encode";
import { decodeMuxed } from "../muxed/decode";

interface FormattingCase {
  description: string;
  input: { base_g: string; id_hex: string };
  expected: { decimal: string; mAddress: string };
  float64Hazard?: string;
}

const doc = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../spec/vectors/subaccount-formatting.json"), "utf8")
) as { cases: FormattingCase[] };

const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)$/;
const UINT64_MAX = (1n << 64n) - 1n;

describe("spec/vectors/subaccount-formatting.json", () => {
  it("includes values at and just below 2^64-1", () => {
    const ids = doc.cases.map((c) => BigInt(c.expected.decimal));
    for (const v of [UINT64_MAX, UINT64_MAX - 1n, UINT64_MAX - 2n]) {
      expect(ids).toContain(v);
    }
  });

  describe.each(doc.cases)("$description", (c) => {
    const id = BigInt(`0x${c.input.id_hex}`);

    it("BigInt.toString() yields the expected plain decimal string", () => {
      const formatted = id.toString();
      expect(formatted).toBe(c.expected.decimal);
      expect(formatted).toMatch(CANONICAL_DECIMAL);
      expect(formatted).not.toMatch(/[eE+.,\s-]/);
      expect(id <= UINT64_MAX).toBe(true);
    });

    it("round-trips through encodeMuxed / decodeMuxed unchanged", () => {
      expect(encodeMuxed(c.input.base_g, BigInt(c.expected.decimal))).toBe(c.expected.mAddress);
      const decoded = decodeMuxed(c.expected.mAddress);
      expect(decoded.baseG).toBe(c.input.base_g);
      expect(decoded.id.toString()).toBe(c.expected.decimal);
    });

    if (c.float64Hazard !== undefined) {
      it("documents the float64 hazard the reference formatter avoids", () => {
        expect(Number(c.expected.decimal).toString()).toBe(c.float64Hazard);
        expect(c.float64Hazard).not.toBe(c.expected.decimal);
      });
    }
  });
});
