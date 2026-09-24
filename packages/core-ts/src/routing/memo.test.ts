import { describe, it, expect } from "vitest";
import fixture from "../../../../spec/memo_text_normalization.json";
import { normalizeMemoTextId } from "./memo";
import { extractRouting } from "./extract";

// Shared with core-go (routing/memo_test.go) and core-dart
// (test/memo_normalization_test.dart) so all three SDKs stay byte-identical.
type Case = {
  input: string;
  normalized: string | null;
  warning: { original: string; normalized: string } | null;
};

const cases = fixture.cases as Case[];
const G_ADDRESS = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";

describe("normalizeMemoTextId cross-SDK parity fixture", () => {
  it.each(cases.map((c) => [JSON.stringify(c.input), c] as const))(
    "normalizes %s per spec/memo_text_normalization.json",
    (_label, c) => {
      const result = normalizeMemoTextId(c.input);

      expect(result.normalized).toBe(c.normalized);

      if (c.warning === null) {
        expect(result.warnings).toEqual([]);
      } else {
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].code).toBe("NON_CANONICAL_ROUTING_ID");
        expect(result.warnings[0].severity).toBe("warn");
        const w = result.warnings[0];
        expect("normalization" in w ? w.normalization : undefined).toEqual(
          c.warning,
        );
      }
    },
  );

  it("never trims surrounding whitespace", () => {
    expect(normalizeMemoTextId(" 123 ").normalized).toBeNull();
    expect(normalizeMemoTextId(" 00123 ").warnings).toEqual([]);
  });
});

describe("extractRouting MEMO_TEXT normalization", () => {
  it("routes '00123' as '123' and surfaces original/normalized strings", () => {
    const result = extractRouting({
      destination: G_ADDRESS,
      memoType: "text",
      memoValue: "00123",
      sourceAccount: null,
    });

    expect(result.routingSource).toBe("memo");
    expect(result.routingId).toBe("123");
    const warning = result.warnings.find(
      (w) => w.code === "NON_CANONICAL_ROUTING_ID",
    );
    expect(
      warning && "normalization" in warning ? warning.normalization : undefined,
    ).toEqual({
      original: "00123",
      normalized: "123",
    });
  });

  it("treats ' 123 ' as unroutable", () => {
    const result = extractRouting({
      destination: G_ADDRESS,
      memoType: "text",
      memoValue: " 123 ",
      sourceAccount: null,
    });

    expect(result.routingSource).toBe("none");
    expect(result.routingId).toBeNull();
    expect(result.warnings.map((w) => w.code)).toEqual([
      "MEMO_TEXT_UNROUTABLE",
    ]);
  });
});
