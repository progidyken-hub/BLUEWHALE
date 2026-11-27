/**
 * Shared vectors: spec/vectors/truncated-addresses.json.
 *
 * Strings that keep the M strkey prefix but lack part of the 40-byte payload
 * must be rejected with INVALID_LENGTH, never with a RangeError, TypeError or
 * any other exception.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { decodeStrKey } from "../strkey/decode";
import { decodeMuxed } from "../muxed/decode";
import { AddressParseError } from "../address/errors";

interface TruncatedCase {
  description: string;
  input: { address: string };
  expected: { ok: boolean; error?: string; kind?: string; address?: string };
}

const doc = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../spec/vectors/truncated-addresses.json"), "utf8")
) as { cases: TruncatedCase[] };

describe("spec/vectors/truncated-addresses.json", () => {
  it("covers every M-address truncation from 10 to 68 characters", () => {
    const lengths = doc.cases
      .filter((c) => c.expected.error === "INVALID_LENGTH" && c.input.address.length < 69)
      .map((c) => c.input.address.length);
    expect(lengths).toEqual(Array.from({ length: 59 }, (_, i) => i + 10));
  });

  describe.each(doc.cases)("$description", (c) => {
    it("decodeStrKey matches the expected result without throwing", () => {
      let result: ReturnType<typeof decodeStrKey> | undefined;
      expect(() => {
        result = decodeStrKey(c.input.address);
      }).not.toThrow();

      if (c.expected.ok) {
        expect(result).toMatchObject({ ok: true, kind: c.expected.kind, address: c.expected.address });
      } else {
        expect(result).toEqual({ ok: false, error: c.expected.error });
      }
    });

    if (!c.expected.ok) {
      it("decodeMuxed throws a structured AddressParseError", () => {
        let error: unknown;
        try {
          decodeMuxed(c.input.address);
        } catch (e) {
          error = e;
        }
        expect(error).toBeInstanceOf(AddressParseError);
        expect((error as AddressParseError).code).toBe(c.expected.error);
      });
    }
  });
});
