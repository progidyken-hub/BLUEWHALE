package routing

import (
	"strings"

	"github.com/REDISHFISH/BLUEWHALE/packages/core-go/address"
)

// uint64MaxStr is the decimal string representation of math.MaxUint64.
const uint64MaxStr = "18446744073709551615"

type NormalizeResult struct {
	Normalized string
	Warnings   []address.Warning
}

// isAllDigits reports whether s is non-empty and contains only ASCII decimal digits.
// This is used instead of a compiled regexp to avoid heap allocations on the hot path.
func isAllDigits(s string) bool {
	if len(s) == 0 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// fitsUint64 reports whether a canonical (no leading zeros) decimal string is within
// the uint64 range. Uses lexicographic comparison to avoid big.Int allocation.
func fitsUint64(s string) bool {
	if len(s) < len(uint64MaxStr) {
		return true
	}
	if len(s) > len(uint64MaxStr) {
		return false
	}
	return s <= uint64MaxStr
}

// NormalizeMemoTextID normalizes a MEMO_TEXT value into a canonical uint64
// routing ID.
//
// Cross-SDK contract (identical in TypeScript and Dart normalizeMemoTextId,
// enforced by spec/memo_text_normalization.json):
//   - The input is never trimmed. Surrounding or embedded whitespace
//     (e.g. " 123 ") makes the memo unroutable: Normalized is "" and no
//     warning is emitted.
//   - Only ASCII digits 0-9 are accepted (no sign, exponent, separators or
//     non-ASCII digits).
//   - Leading zeros (e.g. "00123") are stripped to the canonical form ("123",
//     or "0" for all zeros) and a single NON_CANONICAL_ROUTING_ID warning is
//     emitted with Normalization.Original set to the raw input and
//     Normalization.Normalized set to the stripped value.
//   - Values above uint64 max are unroutable; any leading-zero warning is kept.
func NormalizeMemoTextID(s string) NormalizeResult {
	if s == "" || !isAllDigits(s) {
		return NormalizeResult{}
	}

	// Strip leading zeros; strings.TrimLeft returns a sub-slice (no allocation).
	normalized := strings.TrimLeft(s, "0")
	if normalized == "" {
		normalized = "0"
	}

	var warnings []address.Warning
	if normalized != s {
		warnings = []address.Warning{{
			Code:     address.WarnNonCanonicalRoutingID,
			Severity: "warn",
			Message:  "Memo routing ID had leading zeros. Normalized to canonical decimal.",
			Normalization: &address.Normalization{
				Original:   s,
				Normalized: normalized,
			},
		}}
	}

	if !fitsUint64(normalized) {
		return NormalizeResult{Warnings: warnings}
	}

	return NormalizeResult{Normalized: normalized, Warnings: warnings}
}
