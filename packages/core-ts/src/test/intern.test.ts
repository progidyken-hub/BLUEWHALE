import { describe, it, expect, beforeEach } from "vitest";
import { internAssetString, internTableSize, clearInternTable } from "../intern";

describe("internAssetString", () => {
  beforeEach(() => {
    clearInternTable();
  });

  it("returns the same reference for equal strings", () => {
    const a = internAssetString("USDC");
    const b = internAssetString("USDC");
    // Both calls must return the identical reference.
    expect(a).toBe(b);
    expect(a).toBe("USDC");
  });

  it("returns distinct references for distinct strings", () => {
    const a = internAssetString("XLM");
    const b = internAssetString("USDC");
    expect(a).toBe("XLM");
    expect(b).toBe("USDC");
  });

  it("returns empty string as-is without storing it", () => {
    const result = internAssetString("");
    expect(result).toBe("");
    expect(internTableSize()).toBe(0);
  });

  it("grows the table for new entries", () => {
    internAssetString("XLM");
    internAssetString("USDC");
    internAssetString("EURC");
    expect(internTableSize()).toBe(3);
  });

  it("does not grow the table for repeated entries", () => {
    internAssetString("XLM");
    internAssetString("XLM");
    internAssetString("XLM");
    expect(internTableSize()).toBe(1);
  });

  it("interns G-address issuer strings", () => {
    const issuer = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";
    const a = internAssetString(issuer);
    const b = internAssetString(issuer);
    expect(a).toBe(b);
    expect(a).toBe(issuer);
  });

  it("evicts oldest entries when the table fills", () => {
    // Fill the table to the eviction boundary (512 entries).
    for (let i = 0; i < 512; i++) {
      internAssetString(`ASSET_${i}`);
    }
    expect(internTableSize()).toBe(512);

    // One more insertion triggers eviction of the oldest quarter (128 entries).
    internAssetString("TRIGGER_EVICT");
    // After eviction: 512 - 128 existing + 1 new = 385
    expect(internTableSize()).toBe(385);
  });

  it("clearInternTable resets size to zero", () => {
    internAssetString("XLM");
    internAssetString("USDC");
    clearInternTable();
    expect(internTableSize()).toBe(0);
  });
});
