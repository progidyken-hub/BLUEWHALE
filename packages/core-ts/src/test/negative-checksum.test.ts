/**
 * Negative test vectors: invalid checksums with valid base32 characters.
 *
 * Each address in this suite uses only characters from the base32 alphabet
 * (A-Z, 2-7) and has the correct length for its address type, but one or both
 * of the trailing CRC16 checksum bytes have been altered. All such inputs must
 * be detected as "invalid" by both `detect()` and `validate()`.
 *
 * These tests guard against implementations that:
 *   - Only verify the first character / type prefix without checking the CRC
 *   - Accept any correctly-prefixed, correctly-lengthed base32 string
 *   - Silently truncate or ignore the checksum bytes
 *
 * The test vector addresses were derived from real valid Stellar addresses by
 * flipping one or two trailing base32 characters to other valid base32 chars,
 * which changes the encoded checksum bytes without introducing non-base32 input.
 */

import { describe, it, expect } from "vitest";
import { detect } from "../address/detect";
import { validate } from "../address/validate";

// ─── Canonical valid addresses (for reference) ────────────────────────────────

/** Valid G-address: GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H */
const VALID_G = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
/** Valid M-address (SEP-23 muxed): MBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OAAAAAAAAAAAPOGVY */
const VALID_M = "MBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OAAAAAAAAAAAPOGVY";
/** Valid C-address (contract): CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526 */
const VALID_C = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";

// ─── Negative vectors: bad checksum, all base32 chars ─────────────────────────

/**
 * G-address – last checksum byte flipped (H → I).
 * All 56 characters are valid base32. CRC16 is wrong.
 */
const G_BAD_LAST_BYTE = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2I";

/**
 * G-address – second-to-last checksum byte flipped (2 → 3).
 * All 56 characters are valid base32. CRC16 is wrong.
 */
const G_BAD_SECOND_LAST_BYTE = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX3H";

/**
 * G-address – both checksum bytes corrupted (2H → 5I).
 * All 56 characters are valid base32. CRC16 is wrong.
 */
const G_BAD_BOTH_CHECKSUM_BYTES = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX5I";

/**
 * G-address – payload byte altered, not checksum (B → I at position 1).
 * All 56 characters are valid base32. The original CRC is now incorrect
 * for the modified payload. Tests that the full payload is CRC-verified.
 */
const G_BAD_PAYLOAD_BYTE = "GIRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

/**
 * M-address (SEP-23) – both checksum bytes corrupted (VY → YZ).
 * All 69 characters are valid base32. CRC16 is wrong.
 */
const M_BAD_BOTH_CHECKSUM_BYTES = "MBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OAAAAAAAAAAAPOGYZ";

/**
 * C-address (contract) – both checksum bytes corrupted (26 → 57).
 * All 56 characters are valid base32. CRC16 is wrong.
 */
const C_BAD_BOTH_CHECKSUM_BYTES = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC557";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify every character is in the Stellar base32 alphabet (A-Z, 2-7). */
function allBase32(address: string): boolean {
  return /^[A-Z2-7]+$/.test(address);
}

// ─── Structural pre-conditions ────────────────────────────────────────────────
// These assertions confirm that the negative vectors really do only use valid
// base32 characters and have the expected length, so the tests are meaningful.

describe("Negative checksum vectors – structural pre-conditions", () => {
  it("G bad-checksum vectors contain only base32 characters", () => {
    expect(allBase32(G_BAD_LAST_BYTE)).toBe(true);
    expect(allBase32(G_BAD_SECOND_LAST_BYTE)).toBe(true);
    expect(allBase32(G_BAD_BOTH_CHECKSUM_BYTES)).toBe(true);
    expect(allBase32(G_BAD_PAYLOAD_BYTE)).toBe(true);
  });

  it("M bad-checksum vector contains only base32 characters", () => {
    expect(allBase32(M_BAD_BOTH_CHECKSUM_BYTES)).toBe(true);
  });

  it("C bad-checksum vector contains only base32 characters", () => {
    expect(allBase32(C_BAD_BOTH_CHECKSUM_BYTES)).toBe(true);
  });

  it("G bad-checksum vectors have the same length as the valid G-address (56 chars)", () => {
    expect(G_BAD_LAST_BYTE.length).toBe(VALID_G.length);
    expect(G_BAD_SECOND_LAST_BYTE.length).toBe(VALID_G.length);
    expect(G_BAD_BOTH_CHECKSUM_BYTES.length).toBe(VALID_G.length);
    expect(G_BAD_PAYLOAD_BYTE.length).toBe(VALID_G.length);
  });

  it("M bad-checksum vector has the same length as the valid M-address (69 chars)", () => {
    expect(M_BAD_BOTH_CHECKSUM_BYTES.length).toBe(VALID_M.length);
  });

  it("C bad-checksum vector has the same length as the valid C-address (56 chars)", () => {
    expect(C_BAD_BOTH_CHECKSUM_BYTES.length).toBe(VALID_C.length);
  });

  it("vectors differ from their valid counterparts", () => {
    expect(G_BAD_LAST_BYTE).not.toBe(VALID_G);
    expect(G_BAD_SECOND_LAST_BYTE).not.toBe(VALID_G);
    expect(G_BAD_BOTH_CHECKSUM_BYTES).not.toBe(VALID_G);
    expect(G_BAD_PAYLOAD_BYTE).not.toBe(VALID_G);
    expect(M_BAD_BOTH_CHECKSUM_BYTES).not.toBe(VALID_M);
    expect(C_BAD_BOTH_CHECKSUM_BYTES).not.toBe(VALID_C);
  });
});

// ─── detect() rejects all bad-checksum addresses ─────────────────────────────

describe("detect() – invalid checksum with valid base32 characters", () => {
  it('returns "invalid" for G-address with last checksum byte flipped', () => {
    expect(detect(G_BAD_LAST_BYTE)).toBe("invalid");
  });

  it('returns "invalid" for G-address with second-to-last checksum byte flipped', () => {
    expect(detect(G_BAD_SECOND_LAST_BYTE)).toBe("invalid");
  });

  it('returns "invalid" for G-address with both checksum bytes corrupted', () => {
    expect(detect(G_BAD_BOTH_CHECKSUM_BYTES)).toBe("invalid");
  });

  it('returns "invalid" for G-address with payload byte altered (checksum now mismatches)', () => {
    expect(detect(G_BAD_PAYLOAD_BYTE)).toBe("invalid");
  });

  it('returns "invalid" for M-address with both checksum bytes corrupted', () => {
    expect(detect(M_BAD_BOTH_CHECKSUM_BYTES)).toBe("invalid");
  });

  it('returns "invalid" for C-address with both checksum bytes corrupted', () => {
    expect(detect(C_BAD_BOTH_CHECKSUM_BYTES)).toBe("invalid");
  });

  // Cross-check: valid addresses are still detected correctly
  it('still returns "G" for the unchanged valid G-address', () => {
    expect(detect(VALID_G)).toBe("G");
  });

  it('still returns "M" for the unchanged valid M-address', () => {
    expect(detect(VALID_M)).toBe("M");
  });

  it('still returns "C" for the unchanged valid C-address', () => {
    expect(detect(VALID_C)).toBe("C");
  });
});

// ─── validate() rejects all bad-checksum addresses ───────────────────────────

describe("validate() – invalid checksum with valid base32 characters", () => {
  it("returns false for G-address with last checksum byte flipped (no kind)", () => {
    expect(validate(G_BAD_LAST_BYTE)).toBe(false);
  });

  it('returns false for G-address with last checksum byte flipped (kind "G")', () => {
    expect(validate(G_BAD_LAST_BYTE, "G")).toBe(false);
  });

  it("returns false for G-address with second-to-last checksum byte flipped", () => {
    expect(validate(G_BAD_SECOND_LAST_BYTE)).toBe(false);
  });

  it("returns false for G-address with both checksum bytes corrupted", () => {
    expect(validate(G_BAD_BOTH_CHECKSUM_BYTES)).toBe(false);
  });

  it("returns false for G-address with payload byte altered", () => {
    expect(validate(G_BAD_PAYLOAD_BYTE)).toBe(false);
  });

  it("returns false for M-address with both checksum bytes corrupted (no kind)", () => {
    expect(validate(M_BAD_BOTH_CHECKSUM_BYTES)).toBe(false);
  });

  it('returns false for M-address with both checksum bytes corrupted (kind "M")', () => {
    expect(validate(M_BAD_BOTH_CHECKSUM_BYTES, "M")).toBe(false);
  });

  it("returns false for C-address with both checksum bytes corrupted (no kind)", () => {
    expect(validate(C_BAD_BOTH_CHECKSUM_BYTES)).toBe(false);
  });

  it('returns false for C-address with both checksum bytes corrupted (kind "C")', () => {
    expect(validate(C_BAD_BOTH_CHECKSUM_BYTES, "C")).toBe(false);
  });

  // Cross-check: valid addresses still pass
  it("still returns true for the valid G-address (no kind)", () => {
    expect(validate(VALID_G)).toBe(true);
  });

  it("still returns true for the valid M-address (no kind)", () => {
    expect(validate(VALID_M)).toBe(true);
  });

  it("still returns true for the valid C-address (no kind)", () => {
    expect(validate(VALID_C)).toBe(true);
  });
});

// ─── Lowercase input – same vectors, lowercase ────────────────────────────────

describe("detect() / validate() – bad checksum, lowercase input", () => {
  it('detect() returns "invalid" for lowercase G bad-checksum', () => {
    expect(detect(G_BAD_BOTH_CHECKSUM_BYTES.toLowerCase())).toBe("invalid");
  });

  it("validate() returns false for lowercase G bad-checksum (no kind)", () => {
    expect(validate(G_BAD_BOTH_CHECKSUM_BYTES.toLowerCase())).toBe(false);
  });

  it('validate() returns false for lowercase G bad-checksum with kind "G"', () => {
    expect(validate(G_BAD_BOTH_CHECKSUM_BYTES.toLowerCase(), "G")).toBe(false);
  });
});
