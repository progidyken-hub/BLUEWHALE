import { BluewhaleError } from "./errors";
import type { DepositDestination } from "./types";
import type { RawOperation } from "./types";

/**
 * Result of parsing a single operation within a batch.
 *
 * Exactly one of `result` or `error` is populated depending on `success`.
 */
export interface DepositBatchItem {
  success: boolean;
  result?: DepositDestination;
  error?: BluewhaleError;
}

/**
 * Parse a batch of raw operations into deposit destinations.
 *
 * Errors are aggregated per item rather than aborting the whole batch on the
 * first failure: the returned array always has one entry per input operation,
 * preserving input order.
 *
 * @param operations Raw operations to parse.
 * @param parse Single-operation parser used for each entry.
 */
export function parseDepositBatch(
  operations: RawOperation[],
  parse: (operation: RawOperation) => DepositDestination,
): DepositBatchItem[] {
  const results: DepositBatchItem[] = new Array(operations.length);

  for (let i = 0; i < operations.length; i++) {
    try {
      results[i] = { success: true, result: parse(operations[i]) };
    } catch (err) {
      const error =
        err instanceof BluewhaleError
          ? err
          : new BluewhaleError(
              // Fall back to a generic code for unexpected failures.
              (err as BluewhaleError)?.code ?? ("UNKNOWN" as never),
              err instanceof Error ? err.message : String(err),
            );
      results[i] = { success: false, error };
    }
  }

  return results;
}
