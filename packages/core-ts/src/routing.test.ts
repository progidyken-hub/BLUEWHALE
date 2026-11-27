import { describe, expect, it } from "vitest";
import { parseDepositDestination } from "./routing";

const VALID_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("parseDepositDestination", () => {
  it("parses a valid destination", () => {
    const result = parseDepositDestination(VALID_ADDRESS);
    expect(result.address).toBe(VALID_ADDRESS);
  });

  it("rejects an invalid destination", () => {
    expect(() => parseDepositDestination("not-an-address")).toThrow();
  });

  it("returns a mutable record by default", () => {
    const result = parseDepositDestination(VALID_ADDRESS);
    expect(Object.isFrozen(result)).toBe(false);
  });

  it("recursively freezes the record when immutable is enabled", () => {
    const result = parseDepositDestination(VALID_ADDRESS, { immutable: true });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.route) {
      for (const route of result.route) {
        expect(Object.isFrozen(route)).toBe(true);
      }
    }
  });

  it("throws on mutation in strict mode when immutable is enabled", () => {
    "use strict";
    const result = parseDepositDestination(VALID_ADDRESS, { immutable: true });
    expect(() => {
      (result as { address: string }).address = "GOTHER";
    }).toThrow(TypeError);
  });
});
