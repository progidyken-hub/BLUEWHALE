import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import * as patterns from "./patterns";
import {
  ANSI_ESCAPE_G,
  CONTROL_CHARS_G,
  DIGITS_ONLY,
  LEADING_ZEROS,
  RFC1035_LABEL,
  TRAILING_SLASH,
} from "./patterns";

const SRC_DIR = __dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".d.ts") ? [p] : [];
  });
}

describe("patterns: flag rules", () => {
  const entries = Object.entries(patterns).filter(
    (e): e is [string, RegExp] => e[1] instanceof RegExp
  );

  it("exports at least one pattern", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s: `g` flag iff the name ends in _G, never `y`", (name, re) => {
    expect(re.sticky).toBe(false);
    expect(re.global).toBe(name.endsWith("_G"));
  });

  it("non-global patterns give the same answer on repeated .test() calls", () => {
    // A `g` regex would alternate true/false here because of lastIndex.
    for (let i = 0; i < 3; i++) {
      expect(DIGITS_ONLY.test("12345")).toBe(true);
      expect(RFC1035_LABEL.test("stellar")).toBe(true);
    }
    expect(DIGITS_ONLY.lastIndex).toBe(0);
    expect(RFC1035_LABEL.lastIndex).toBe(0);
  });

  it("global patterns are safe to share across replace() calls", () => {
    const msg = "\x1b[31mred\x1b[0m\x07";
    expect(msg.replace(ANSI_ESCAPE_G, "")).toBe("red\x07");
    expect(msg.replace(ANSI_ESCAPE_G, "")).toBe("red\x07");
    expect(ANSI_ESCAPE_G.lastIndex).toBe(0);
    expect("a\x00b\x9fc\td\ne".replace(CONTROL_CHARS_G, "")).toBe("abc\td\ne");
    expect(CONTROL_CHARS_G.lastIndex).toBe(0);
  });
});

describe("patterns: behaviour", () => {
  it("DIGITS_ONLY", () => {
    expect(DIGITS_ONLY.test("0")).toBe(true);
    expect(DIGITS_ONLY.test("18446744073709551615")).toBe(true);
    for (const bad of ["", " 1", "1 ", "-1", "1.0", "1e3", "١٢٣", "12\n"]) {
      expect(DIGITS_ONLY.test(bad)).toBe(false);
    }
  });

  it("LEADING_ZEROS strips only the leading run", () => {
    expect("000120".replace(LEADING_ZEROS, "")).toBe("120");
    expect("0".replace(LEADING_ZEROS, "")).toBe("");
    expect("120".replace(LEADING_ZEROS, "")).toBe("120");
  });

  it("TRAILING_SLASH strips exactly one trailing slash", () => {
    expect("https://h.example/".replace(TRAILING_SLASH, "")).toBe("https://h.example");
    expect("https://h.example//".replace(TRAILING_SLASH, "")).toBe("https://h.example/");
    expect("https://h.example".replace(TRAILING_SLASH, "")).toBe("https://h.example");
  });

  it("RFC1035_LABEL", () => {
    for (const ok of ["a", "stellar", "a-b", "x".repeat(63), "0x1"]) {
      expect(RFC1035_LABEL.test(ok)).toBe(true);
    }
    for (const bad of ["", "-a", "a-", "x".repeat(64), "a_b", "a.b", "é"]) {
      expect(RFC1035_LABEL.test(bad)).toBe(false);
    }
  });
});

describe("patterns: no regexes built inside functions", () => {
  // Inline regex literals passed straight to a method, e.g. s.replace(/x/, "").
  const INLINE_LITERAL = /\.(?:test|exec|match|matchAll|replace|replaceAll|search|split)\(\s*\/(?![/*])/;
  // Regex literals assigned to a local, e.g. `const re = /^x$/;` inside a body.
  const INDENTED_LITERAL_DECL = /^\s+(?:const|let|var)\s+\w+\s*=\s*\/(?![/*])/;
  const REGEXP_CTOR = /\bnew\s+RegExp\s*\(|(?<![.\w])RegExp\s*\(/;

  const offenders: string[] = [];
  for (const file of sourceFiles(SRC_DIR)) {
    if (file.endsWith("patterns.ts")) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "").trim();
        if (code.startsWith("*") || code.startsWith("/*")) return;
        if (INLINE_LITERAL.test(line) || INDENTED_LITERAL_DECL.test(line) || REGEXP_CTOR.test(code)) {
          offenders.push(`${relative(SRC_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
  }

  it("every regex in src/ lives in src/patterns.ts", () => {
    expect(offenders).toEqual([]);
  });
});

/**
 * Throughput benchmark. Timing is noisy on shared CI runners, so the speedup
 * is only asserted with BENCHMARK=1:
 *
 *   BENCHMARK=1 pnpm --filter @redishfish/bluewhale-core test -- src/patterns.test.ts
 *
 * The baseline is `new RegExp(...)` per iteration, the pattern the hoisting
 * guards against. V8 already caches compiled regex *literals*, so replacing an
 * inline literal with a constant is roughly throughput-neutral. That case is
 * measured and logged but not asserted.
 */
describe.runIf(process.env.BENCHMARK === "1")("patterns: throughput", () => {
  const LABEL_SOURCE = RFC1035_LABEL.source;
  const domains = Array.from(
    { length: 2000 },
    (_, i) => `a${i}.sub-${i % 7}.example${i % 13}.stellar.org`
  );

  const perIterationCtor = (d: string) =>
    d.split(".").every((l) => new RegExp(LABEL_SOURCE).test(l));
  const perIterationLiteral = (d: string) =>
    d.split(".").every((l) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(l));
  const hoisted = (d: string) => d.split(".").every((l) => RFC1035_LABEL.test(l));

  function medianMs(fn: (d: string) => boolean, rounds = 7, iters = 50): number {
    let sink = 0;
    for (let w = 0; w < 10; w++) for (const d of domains) sink ^= Number(fn(d));
    const times: number[] = [];
    for (let r = 0; r < rounds; r++) {
      const start = performance.now();
      for (let k = 0; k < iters; k++) for (const d of domains) sink ^= Number(fn(d));
      times.push(performance.now() - start);
    }
    expect(sink).toBeTypeOf("number");
    return times.sort((a, b) => a - b)[Math.floor(rounds / 2)];
  }

  it("hoisted constant is >= 10% faster than new RegExp per iteration", () => {
    const ctor = medianMs(perIterationCtor);
    const literal = medianMs(perIterationLiteral);
    const constant = medianMs(hoisted);
    const gain = (base: number) => `${((base / constant - 1) * 100).toFixed(1)}%`;
    console.log(
      `RFC1035 label check over ${domains.length} domains x 50: ` +
        `new RegExp ${ctor.toFixed(1)}ms, inline literal ${literal.toFixed(1)}ms, ` +
        `hoisted ${constant.toFixed(1)}ms (gain vs ctor ${gain(ctor)}, vs literal ${gain(literal)})`
    );
    expect(constant).toBeLessThanOrEqual(ctor / 1.1);
  });
});
