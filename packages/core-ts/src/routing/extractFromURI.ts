/**
 * SEP-0007 URI Parser
 *
 * Parses `web+stellar:pay?...` URIs (commonly from QR code scanners)
 * and delegates to the core `extractRouting` logic to produce canonical
 * routing information.
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

import { extractRouting } from "./extract";
import { internAssetCode, internAssetIssuer } from "./assetIntern";
import type { RoutingInput, RoutingResult } from "./types";

export interface SEP7PayParams {
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
  memoType?: string;
  callback?: string;
  msg?: string;
  networkPassphrase?: string;
  originDomain?: string;
  signature?: string;
}

export type ExtractRoutingFromURIResult =
  | {
      success: true;
      routing: RoutingResult;
      rawParams: SEP7PayParams;
    }
  | {
      success: false;
      error: string;
      code: "INVALID_URI" | "UNSUPPORTED_OPERATION" | "MISSING_DESTINATION" | "INVALID_ENCODING";
    };

/**
 * Map SEP-0007 memo_type values to internal KnownMemoType.
 */
function mapMemoType(sep7MemoType: string | undefined): RoutingInput["memoType"] {
  if (!sep7MemoType) return "none";

  const upper = sep7MemoType.toUpperCase();
  switch (upper) {
    case "MEMO_ID":
      return "id";
    case "MEMO_TEXT":
      return "text";
    case "MEMO_HASH":
      return "hash";
    case "MEMO_RETURN":
      return "return";
    default:
      return "none";
  }
}

/**
 * Parse a SEP-0007 URI and extract canonical routing information.
 *
 * Supported format:
 *   web+stellar:pay?destination=<G...>&memo=<value>&memo_type=<MEMO_TEXT|MEMO_ID|MEMO_HASH|MEMO_RETURN>
 *
 * The function safely decodes URL-encoded parameters, validates the scheme,
 * and passes `destination` + `memo` into `extractRouting()` for canonical
 * output (handling G-addresses, M-addresses, C-addresses, etc.).
 *
 * @param uriString - The raw URI string from a QR code scanner or deeplink
 * @returns ExtractRoutingFromURIResult
 *
 * @example
 * ```ts
 * const result = extractRoutingFromURI(
 *   "web+stellar:pay?destination=GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI&memo=123&memo_type=MEMO_ID"
 * );
 * if (result.success) {
 *   console.log(result.routing.destinationBaseAccount); // "GAYC..."
 *   console.log(result.routing.routingId);            // "123"
 * }
 * ```
 */
/**
 * Sensitive query parameter keys that must be redacted in error messages and logs.
 */
const SENSITIVE_PARAM_KEYS = new Set([
  "signature",
  "callback",
  "memo",
  "msg",
]);

/**
 * Sanitizes a URI or query string for logging and error descriptions
 * by redacting sensitive parameters (signature, callback, memo, msg).
 */
export function sanitizeSep7UriForLogging(uriOrText: string): string {
  if (!uriOrText) return uriOrText;

  const qIndex = uriOrText.indexOf("?");
  if (qIndex === -1 && !uriOrText.includes("=")) {
    return uriOrText;
  }

  const prefix = qIndex !== -1 ? uriOrText.slice(0, qIndex + 1) : "";
  const query = qIndex !== -1 ? uriOrText.slice(qIndex + 1) : uriOrText;

  const pairs = query.split("&");
  const sanitizedPairs = pairs.map((pair) => {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) return pair;
    const key = pair.slice(0, eqIndex);
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_PARAM_KEYS.has(lowerKey)) {
      return `${key}=[REDACTED]`;
    }
    return pair;
  });

  return `${prefix}${sanitizedPairs.join("&")}`;
}

export function extractRoutingFromURI(uriString: string): ExtractRoutingFromURIResult {
  // 1. Validate scheme
  if (!uriString.startsWith("web+stellar:")) {
    return {
      success: false,
      error: "URI must use 'web+stellar:' scheme",
      code: "INVALID_URI",
    };
  }

  // 2. Split operation and query string
  const withoutScheme = uriString.slice("web+stellar:".length);
  const [operation, queryString] = withoutScheme.includes("?")
    ? withoutScheme.split("?", 2)
    : [withoutScheme, ""];

  // 3. Only 'pay' operation is supported for routing extraction.
  // The operation is URI-derived text, so it passes through the query
  // sanitizer before reaching the error description.
  if (operation !== "pay") {
    const sanitizedOp = sanitizeSep7UriForLogging(operation);
    return {
      success: false,
      error: `Unsupported operation: '${sanitizeSep7UriForLogging(operation)}'. Only 'pay' is supported for routing extraction.`,
      code: "UNSUPPORTED_OPERATION",
    };
  }

  // 4. Parse query parameters safely
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(queryString);
  } catch {
    return {
      success: false,
      error: "Failed to parse URI query parameters",
      code: "INVALID_ENCODING",
    };
  }

  // 5. Extract required destination
  const destination = params.get("destination");
  if (!destination || destination.trim() === "") {
    return {
      success: false,
      error: "Missing required 'destination' parameter",
      code: "MISSING_DESTINATION",
    };
  }

  // 6. Extract optional parameters with safe decoding.
  //    Asset codes and issuer addresses are routed through the intern table so
  //    repeated values (the same USDC issuer seen on every payment) share a
  //    single string reference rather than allocating a new one each time.
  const rawParams: SEP7PayParams = {
    destination: safelyDecode(destination.trim()),
    amount: safelyDecode(params.get("amount")),
    assetCode: internAssetCode(safelyDecode(params.get("asset_code"))),
    assetIssuer: internAssetIssuer(safelyDecode(params.get("asset_issuer"))),
    memo: safelyDecode(params.get("memo")),
    memoType: safelyDecode(params.get("memo_type")),
    callback: safelyDecode(params.get("callback")),
    msg: safelyDecode(params.get("msg")),
    networkPassphrase: safelyDecode(params.get("network_passphrase")),
    originDomain: safelyDecode(params.get("origin_domain")),
    signature: safelyDecode(params.get("signature")),
  };

  // 7. Build RoutingInput for extractRouting
  const routingInput: RoutingInput = {
    destination: rawParams.destination,
    memoType: mapMemoType(rawParams.memoType),
    memoValue: rawParams.memo ?? null,
    sourceAccount: null,
  };

  // 8. Delegate to core extractRouting logic
  const routingResult = extractRouting(routingInput);

  // 9. Return combined result
  return {
    success: true,
    routing: routingResult,
    rawParams,
  };
}

/**
 * Safely decode a URL-encoded value, returning undefined for null/empty.
 */
function safelyDecode(value: string | null): string | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // Return raw if decoding fails
  }
}

/**
 * Type guard for successful URI parsing.
 */
export function isSuccessfulURIResult(
  result: ExtractRoutingFromURIResult
): result is ExtractRoutingFromURIResult & { success: true } {
  return result.success === true;
}