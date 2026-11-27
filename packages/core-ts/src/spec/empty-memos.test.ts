/**
 * Runs spec/vectors/empty-memos.json against core-ts. The same file is run by
 * core-go (routing/empty_memos_vectors_test.go) and core-dart
 * (test/empty_memos_vectors_test.dart).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractRouting, effectiveMemoType, isBlankMemoText } from "../index";

type EmptyMemoCase = {
  id: string;
  description: string;
  input: { destination: string; memoType: string; memoValue?: string | null };
  expected: {
    effectiveMemoType: string;
    destinationBaseAccount: string | null;
    routingId: string | null;
    routingSource: string;
    warnings: { code: string; severity: string }[];
  };
};

const { cases } = JSON.parse(
  readFileSync(join(__dirname, "../../../../spec/vectors/empty-memos.json"), "utf8")
) as { cases: EmptyMemoCase[] };

describe("spec/vectors/empty-memos.json", () => {
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    const memoValue = c.input.memoValue ?? null;

    expect(effectiveMemoType(c.input.memoType, memoValue)).toBe(c.expected.effectiveMemoType);
    if (c.input.memoType === "text") {
      expect(isBlankMemoText(memoValue)).toBe(c.expected.effectiveMemoType === "none");
    }

    const result = extractRouting({
      destination: c.input.destination,
      memoType: c.input.memoType,
      memoValue,
      sourceAccount: null,
    });

    expect(result.destinationBaseAccount).toBe(c.expected.destinationBaseAccount);
    expect(result.routingId === null ? null : String(result.routingId)).toBe(
      c.expected.routingId
    );
    expect(result.routingSource).toBe(c.expected.routingSource);
    expect(result.warnings.map(({ code, severity }) => ({ code, severity }))).toEqual(
      c.expected.warnings
    );
  });

  it("treats undefined like null", () => {
    expect(effectiveMemoType("text", undefined)).toBe("none");
  });
});
