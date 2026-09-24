import { describe, it, expect } from "vitest";
import schema from "../../../../spec/schema.json";
import {
  ADDRESS_PARSE_ERROR_CODES,
  AddressParseError,
  isAddressParseErrorCode,
} from "./errors";
import { parse } from "./parse";

describe("AddressParseErrorCode", () => {
  it("matches the errorCode enum in spec/schema.json exactly", () => {
    expect([...ADDRESS_PARSE_ERROR_CODES]).toEqual(
      schema.definitions.errorCode.enum,
    );
  });

  it("recognizes canonical codes and rejects anything else", () => {
    for (const code of ADDRESS_PARSE_ERROR_CODES) {
      expect(isAddressParseErrorCode(code)).toBe(true);
    }
    expect(isAddressParseErrorCode("invalid_checksum")).toBe(false);
    expect(isAddressParseErrorCode("UNKNOWN")).toBe(false);
    expect(isAddressParseErrorCode(undefined)).toBe(false);
  });

  it("only ever surfaces canonical codes from parse()", () => {
    const inputs = [
      "",
      "XYZ",
      "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSJ",
      "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRS",
      "SAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI",
      "alice*example.com",
    ];
    for (const input of inputs) {
      try {
        const result = parse(input);
        if (result.kind === "invalid") {
          expect(isAddressParseErrorCode(result.error.code)).toBe(true);
        }
      } catch (e) {
        expect(e).toBeInstanceOf(AddressParseError);
        expect(isAddressParseErrorCode((e as AddressParseError).code)).toBe(
          true,
        );
      }
    }
  });
});
