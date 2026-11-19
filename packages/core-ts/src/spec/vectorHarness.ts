/**
 * Shared harness for the normative test-vector runners.
 *
 * The vector suite is split into one test file per module
 * (`vectors.<module>.test.ts`) so vitest can run the modules in parallel
 * worker threads across CPU cores (issue #452) instead of executing the
 * whole suite on a single core. This module holds the helpers and the
 * legacy-vector normalization that several runners share, mirroring the
 * approach in core-dart's spec runner.
 */

import { vectors } from "@redishfish/bluewhale-spec";
import {
  detect,
  encodeMuxed,
  decodeMuxed,
  extractRouting,
  extractRoutingFromURI,
} from "../index";

export {
  vectors,
  detect,
  encodeMuxed,
  decodeMuxed,
  extractRouting,
  extractRoutingFromURI,
};

/** Normalizes a routing ID (bigint or string) to its canonical string form. */
export function normalizeRoutingId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? value.toString() : String(value);
}

// The canonical vector suite carries a handful of "legacy" placeholder
// addresses (a short G/M/C form with an invalid checksum) that current
// stellar-sdk rejects at checksum validation. core-dart's spec runner
// normalizes these to real, checksum-valid addresses before running them
// (see packages/core-dart/test/spec_runner_test.dart). We mirror that
// normalization here so core-ts exercises the same vector surface instead of
// silently skipping it the way core-go does.
const LEGACY_VECTOR_G = "GA7QYNF7SZFX4X7X5JFZZ3UQ6BXHDSY2RKVKZKX5FFQJ1ZMZX1";
const LEGACY_VECTOR_M_PREFIX =
  "MA7QYNF7SZFX4X7X5JFZZ3UQ6BXHDSY2RKVKZKX5FFQJ1ZMZX1";
const LEGACY_VECTOR_C_PREFIX =
  "CA7QYNF7SZFX4X7X5JFZZ3UQ6BXHDSY2RKVKZKX5FFQJ1ZMZX1";
const VALID_G = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI";
const VALID_C = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export function normalizeVectorDestination(
  destination: string,
  expectedRoutingId: string | null
): string {
  if (destination === LEGACY_VECTOR_G) return VALID_G;
  if (destination.startsWith(LEGACY_VECTOR_M_PREFIX)) {
    return encodeMuxed(VALID_G, BigInt(expectedRoutingId ?? "0"));
  }
  if (destination.startsWith(LEGACY_VECTOR_C_PREFIX)) return VALID_C;
  return destination;
}

export function normalizeExpectedBaseAccount(
  destinationBaseAccount: string | null
): string | null {
  if (destinationBaseAccount === LEGACY_VECTOR_G) return VALID_G;
  return destinationBaseAccount ?? null;
}
