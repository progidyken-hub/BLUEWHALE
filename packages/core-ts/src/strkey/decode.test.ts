import { decode, sanitizeAddress } from "./decode";
import { StrKey } from "./strkey";

describe("sanitizeAddress", () => {
  const valid = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

  it("strips leading and trailing ASCII whitespace", () => {
    expect(sanitizeAddress(`  ${valid}\t\n`)).toBe(valid);
  });

  it("strips leading and trailing zero-width spaces", () => {
    expect(sanitizeAddress(`\u200B${valid}\u200B`)).toBe(valid);
  });

  it("strips a mix of whitespace and zero-width spaces", () => {
    expect(sanitizeAddress(` \u200B ${valid} \u200B `)).toBe(valid);
  });

  it("leaves an already-clean address untouched", () => {
    expect(sanitizeAddress(valid)).toBe(valid);
  });

  it("rejects non-printable characters embedded in the body", () => {
    const embedded = `${valid.slice(0, 10)}\u200B${valid.slice(10)}`;
    expect(() => sanitizeAddress(embedded)).toThrow(
      "Address contains non-printable characters",
    );
  });

  it("rejects embedded control characters", () => {
    const embedded = `${valid.slice(0, 10)}\u0000${valid.slice(10)}`;
    expect(() => sanitizeAddress(embedded)).toThrow(
      "Address contains non-printable characters",
    );
  });
});

describe("decode", () => {
  const valid = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";

  it("decodes a clean address", () => {
    expect(decode(valid)).toEqual(StrKey.decode(valid));
  });

  it("decodes an address with surrounding whitespace and zero-width spaces", () => {
    expect(decode(` \u200B${valid}\u200B `)).toEqual(StrKey.decode(valid));
  });

  it("throws when non-printable characters are embedded", () => {
    const embedded = `${valid.slice(0, 10)}\u200B${valid.slice(10)}`;
    expect(() => decode(embedded)).toThrow(
      "Address contains non-printable characters",
    );
  });
});
