/**
 * Runs every case in spec/regex.json through the ECMAScript RegExp engine.
 *
 * The same cases are asserted in core-go (address/regex_spec_test.go),
 * core-dart (test/regex_spec_test.dart) and, for PCRE/Perl, in
 * scripts/check-regex-spec.js.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type RegexSpec = {
  patterns: Record<string, { pattern: string }>;
  cases: { pattern: string; input: string; match: boolean; description: string }[];
};

const spec: RegexSpec = JSON.parse(
  readFileSync(join(__dirname, "../../../../spec/regex.json"), "utf8")
);

const compiled = Object.fromEntries(
  Object.entries(spec.patterns).map(([name, def]) => [name, new RegExp(def.pattern)])
);

describe("spec/regex.json parity (ECMAScript RegExp)", () => {
  it.each(spec.cases.map((c) => [`[${c.pattern}] ${c.description}`, c] as const))(
    "%s",
    (_label, c) => {
      const re = compiled[c.pattern];
      expect(re, `unknown pattern ${c.pattern}`).toBeDefined();
      expect(re.test(c.input)).toBe(c.match);
    }
  );
});
