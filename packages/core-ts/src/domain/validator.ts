import { RFC1035_LABEL } from "../patterns";

/**
 * RFC 1035 Domain Name Validator.
 *
 * Implements domain name syntax validation according to RFC 1035 §2.3.1 & RFC 1123:
 * - Total domain length must not exceed 253 ASCII characters.
 * - Labels are separated by periods (dots).
 * - Each label must be between 1 and 63 characters in length.
 * - Labels may only contain alphanumeric characters (a-z, A-Z, 0-9) and hyphens (-).
 * - Labels must not start or end with a hyphen.
 * - Empty labels (consecutive dots, leading dot) are disallowed.
 */

export interface DomainValidationOptions {
  /**
   * If true, allows a single trailing dot indicating a fully qualified domain name (FQDN).
   * Defaults to true.
   */
  allowTrailingDot?: boolean;

  /**
   * If true, requires at least two labels (domain + TLD).
   * Defaults to true.
   */
  requireTLD?: boolean;

  /**
   * If true, allows IPv4 and IPv6 literals instead of RFC 1035 hostnames.
   * Defaults to false.
   */
  allowIpLiterals?: boolean;
}

export interface DomainValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
  code?:
    | "EMPTY_DOMAIN"
    | "DOMAIN_TOO_LONG"
    | "LABEL_EMPTY"
    | "LABEL_TOO_LONG"
    | "LABEL_INVALID_START"
    | "LABEL_INVALID_END"
    | "LABEL_INVALID_CHARS"
    | "MISSING_TLD"
    | "IP_LITERAL_DISALLOWED";
}

const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

/**
 * Validates a domain name according to RFC 1035 / RFC 1123 specifications.
 *
 * @param domain The domain string to validate.
 * @param options Optional configuration parameters.
 * @returns DomainValidationResult with valid boolean and diagnostic error/code.
 */
export function validateDomain(
  domain: string,
  options: DomainValidationOptions = {}
): DomainValidationResult {
  const {
    allowTrailingDot = true,
    requireTLD = true,
    allowIpLiterals = false,
  } = options;

  if (typeof domain !== "string" || domain.trim() === "") {
    return {
      valid: false,
      error: "Domain name cannot be empty",
      code: "EMPTY_DOMAIN",
    };
  }

  let cleaned = domain.trim();
  if (isIpLiteral(cleaned)) {
    if (allowIpLiterals) {
      return { valid: true, normalized: cleaned.toLowerCase() };
    }
    return {
      valid: false,
      error: "IP address literals are not allowed as domain names",
      code: "IP_LITERAL_DISALLOWED",
    };
  }

  // Handle trailing dot for root label (FQDN)
  if (cleaned.endsWith(".")) {
    if (!allowTrailingDot) {
      return {
        valid: false,
        error: "Trailing dot is not allowed",
        code: "LABEL_EMPTY",
      };
    }
    cleaned = cleaned.slice(0, -1);
  }

  if (cleaned.length === 0) {
    return {
      valid: false,
      error: "Domain name cannot be empty or solely a dot",
      code: "EMPTY_DOMAIN",
    };
  }

  if (cleaned.length > MAX_DOMAIN_LENGTH) {
    return {
      valid: false,
      error: `Domain name length (${cleaned.length}) exceeds maximum of ${MAX_DOMAIN_LENGTH} characters`,
      code: "DOMAIN_TOO_LONG",
    };
  }

  let labelCount = 1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned.charCodeAt(i) === 0x2e) labelCount++;
  }

  if (requireTLD && labelCount < 2) {
    return {
      valid: false,
      error: "Domain name must contain at least two labels (including TLD)",
      code: "MISSING_TLD",
    };
  }

  let labelStart = 0;
  let labelLength = 0;
  let labelPosition = 1;
  for (let i = 0; i <= cleaned.length; i++) {
    const atEnd = i === cleaned.length;
    const code = atEnd ? -1 : cleaned.charCodeAt(i);
    if (!atEnd && code !== 0x2e) {
      labelLength++;
      continue;
    }

    const label = cleaned.slice(labelStart, i);
    if (labelLength === 0) {
      return {
        valid: false,
        error: `Empty label detected at position ${labelPosition} (consecutive or leading dots)`,
        code: "LABEL_EMPTY",
      };
    }

    if (labelLength > MAX_LABEL_LENGTH) {
      return {
        valid: false,
        error: `Label "${label}" length (${labelLength}) exceeds maximum of ${MAX_LABEL_LENGTH} characters`,
        code: "LABEL_TOO_LONG",
      };
    }

    if (cleaned.charCodeAt(labelStart) === 0x2d) {
      return {
        valid: false,
        error: `Label "${label}" must not start with a hyphen`,
        code: "LABEL_INVALID_START",
      };
    }

    if (cleaned.charCodeAt(i - 1) === 0x2d) {
      return {
        valid: false,
        error: `Label "${label}" must not end with a hyphen`,
        code: "LABEL_INVALID_END",
      };
    }

    if (!RFC1035_LABEL.test(label)) {
      return {
        valid: false,
        error: `Label "${label}" contains invalid characters; only ASCII alphanumeric and hyphens are permitted`,
        code: "LABEL_INVALID_CHARS",
      };
    }

    labelStart = i + 1;
    labelLength = 0;
    labelPosition++;
  }

  return {
    valid: true,
    normalized: cleaned.toLowerCase(),
  };
}

/**
 * Returns true if the given domain string is valid according to RFC 1035.
 */
export function isValidDomain(
  domain: string,
  options?: DomainValidationOptions
): boolean {
  return validateDomain(domain, options).valid;
}

/** Returns true if input is an IPv4 or IPv6 address literal. */
export function isIpLiteral(input: string): boolean {
  if (typeof input !== "string" || input.length === 0 || input.length > 253) {
    return false;
  }

  const address =
    input.startsWith("[") && input.endsWith("]")
      ? input.slice(1, -1)
      : input;
  if (address.includes(".")) return isIpv4Literal(address);
  if (!address.includes(":")) return false;

  const compression = address.indexOf("::");
  if (
    compression !== -1 &&
    address.indexOf("::", compression + 2) !== -1
  ) {
    return false;
  }

  const sides =
    compression === -1
      ? [address]
      : [address.slice(0, compression), address.slice(compression + 2)];
  let groups = 0;
  for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
    const side = sides[sideIndex];
    if (side === "") continue;
    const parts = side.split(":");
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      if (part.includes(".")) {
        if (
          sideIndex !== sides.length - 1 ||
          partIndex !== parts.length - 1 ||
          !isIpv4Literal(part)
        ) {
          return false;
        }
        groups += 2;
        continue;
      }
      if (part.length < 1 || part.length > 4) return false;
      for (let i = 0; i < part.length; i++) {
        const code = part.charCodeAt(i);
        if (
          !(
            (code >= 0x30 && code <= 0x39) ||
            (code >= 0x41 && code <= 0x46) ||
            (code >= 0x61 && code <= 0x66)
          )
        ) {
          return false;
        }
      }
      groups++;
    }
  }

  return compression === -1 ? groups === 8 : groups < 8;
}

function isIpv4Literal(input: string): boolean {
  const parts = input.split(".");
  if (parts.length !== 4) return false;

  for (const part of parts) {
    if (part.length === 0 || part.length > 3) return false;
    let value = 0;
    for (let i = 0; i < part.length; i++) {
      const code = part.charCodeAt(i);
      if (code < 0x30 || code > 0x39) return false;
      value = value * 10 + code - 0x30;
    }
    if (value > 255) return false;
  }
  return true;
}
