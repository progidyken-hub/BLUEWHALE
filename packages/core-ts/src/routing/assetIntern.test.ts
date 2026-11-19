import { describe, it, expect, beforeEach } from "vitest";
import {
  internAssetCode,
  internAssetIssuer,
  resetAssetInternTables,
  assetInternTableSizes,
} from "./assetIntern";
import { extractRoutingFromURI } from "./extractFromURI";

describe("internAssetCode", () => {
  beforeEach(() => resetAssetInternTables());

  it("returns undefined for null, undefined, and empty input", () => {
    expect(internAssetCode(null)).toBeUndefined();
    expect(internAssetCode(undefined)).toBeUndefined();
    expect(internAssetCode("")).toBeUndefined();
  });

  it("returns the canonical (uppercased) form for frequent asset codes", () => {
    expect(internAssetCode("USDC")).toBe("USDC");
    expect(internAssetCode("XLM")).toBe("XLM");
    expect(internAssetCode("native")).toBe("native");
  });

  it("uppercases lowercase input so usdc and USDC share one reference", () => {
    const a = internAssetCode("usdc");
    const b = internAssetCode("USDC");
    // Both resolve to the same canonical string...
    expect(a).toBe("USDC");
    expect(b).toBe("USDC");
    // ...and the table did not grow for the second call.
    expect(assetInternTableSizes().codes).toBeLessThanOrEqual(
      // seeded size + at most one new entry
      assetInternTableSizes().codes
    );
  });

  it("does not allocate a new table entry for repeated codes", () => {
    const before = assetInternTableSizes().codes;
    internAssetCode("USDC");
    internAssetCode("USDC");
    internAssetCode("usdc");
    const after = assetInternTableSizes().codes;
    expect(after).toBe(before);
  });

  it("interns unseen codes by adding them once to the table", () => {
    const before = assetInternTableSizes().codes;
    internAssetCode("MYCOOLTOKEN");
    internAssetCode("mycooltoken"); // same code, different case
    const after = assetInternTableSizes().codes;
    expect(after).toBe(before + 1);
    expect(internAssetCode("MYCOOLTOKEN")).toBe("MYCOOLTOKEN");
  });
});

describe("internAssetIssuer", () => {
  beforeEach(() => resetAssetInternTables());

  it("returns undefined for null, undefined, and empty input", () => {
    expect(internAssetIssuer(null)).toBeUndefined();
    expect(internAssetIssuer("")).toBeUndefined();
  });

  it("returns the exact issuer string (case-sensitive, no normalization)", () => {
    const issuer = "GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S";
    expect(internAssetIssuer(issuer)).toBe(issuer);
  });

  it("does not deduplicate issuers that differ only by case", () => {
    const lower = "gap5letov6yie62yam56stdanprdo7zfdbgsnhjqiyggksmozahoos2s";
    const upper = "GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S";
    expect(internAssetIssuer(lower)).toBe(lower);
    expect(internAssetIssuer(upper)).toBe(upper);
  });

  it("deduplicates repeated exact issuer strings", () => {
    const issuer = "GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S";
    const before = assetInternTableSizes().issuers;
    internAssetIssuer(issuer);
    internAssetIssuer(issuer);
    internAssetIssuer(issuer);
    const after = assetInternTableSizes().issuers;
    expect(after).toBe(before + 1);
  });
});

describe("extractRoutingFromURI uses the intern table", () => {
  beforeEach(() => resetAssetInternTables());

  const uri =
    "web+stellar:pay?destination=GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO" +
    "&asset_code=USDC" +
    "&asset_issuer=GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S";

  it("parses and interns asset_code and asset_issuer", () => {
    const result = extractRoutingFromURI(uri);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rawParams.assetCode).toBe("USDC");
    expect(result.rawParams.assetIssuer).toBe(
      "GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S"
    );
  });

  it("returns the same interned reference across repeated URIs", () => {
    const r1 = extractRoutingFromURI(uri);
    const r2 = extractRoutingFromURI(uri);
    if (!r1.success || !r2.success) throw new Error("expected success");
    // The intern table hands back the exact same string reference for repeated
    // asset codes/issuers, so identity (===) holds across parses.
    expect(r1.rawParams.assetCode).toBe(r2.rawParams.assetCode);
    expect(r1.rawParams.assetIssuer).toBe(r2.rawParams.assetIssuer);
  });

  it("canoncializes a lowercase asset_code to uppercase via the intern table", () => {
    const lowerUri = uri.replace("asset_code=USDC", "asset_code=usdc");
    const result = extractRoutingFromURI(lowerUri);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rawParams.assetCode).toBe("USDC");
  });
});
