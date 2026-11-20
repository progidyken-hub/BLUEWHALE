/**
 * Shared vectors: spec/vectors/case-sensitivity.json.
 *
 * StrKeys are uppercase. decodeStrKey rejects lowercase input with
 * INVALID_BASE32 unless the caller opts in with { allowLowercase: true }.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { decodeStrKey } from "../strkey/decode";

interface CaseVector {
  description: string;
  input: { address: string; allowLowercase: boolean };
  expected:
    | { ok: true; kind: string; address: string; normalized: boolean }
    | { ok: false; error: string };
}

const doc = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../spec/vectors/case-sensitivity.json"), "utf8")
) as { cases: CaseVector[] };

describe("spec/vectors/case-sensitivity.json", () => {
  it("covers lowercase g..., m... and c... addresses", () => {
    const prefixes = new Set(
      doc.cases
        .filter((c) => !c.input.allowLowercase && !c.expected.ok && /^[gmc]/.test(c.input.address))
        .map((c) => c.input.address[0])
    );
    expect([...prefixes].sort()).toEqual(["c", "g", "m"]);
  });

  it.each(doc.cases)("$description", (c) => {
    const result = decodeStrKey(c.input.address, { allowLowercase: c.input.allowLowercase });
    if (c.expected.ok) {
      expect(result).toMatchObject(c.expected);
    } else {
      expect(result).toEqual(c.expected);
    }
  });

  it("rejects lowercase when no options are passed", () => {
    const lower = doc.cases.find((c) => !c.input.allowLowercase && c.input.address === c.input.address.toLowerCase());
    expect(lower).toBeDefined();
    expect(decodeStrKey(lower!.input.address)).toEqual({ ok: false, error: "INVALID_BASE32" });
  });
});
