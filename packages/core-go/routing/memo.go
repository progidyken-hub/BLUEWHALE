package routing

import (
	"errors"
	"strings"

	"github.com/REDISHFISH/BLUEWHALE/packages/core-go/address"
)

// uint64MaxStr is the decimal string representation of math.MaxUint64.
const uint64MaxStr = "18446744073709551615"

// maxMemoTextBytes is the maximum byte length allowed for a MEMO_TEXT value.
const maxMemoTextBytes = 28

// ErrMemoTooLong is returned when a memo string exceeds the 28-byte MEMO_TEXT limit.
var ErrMemoTooLong = errors.New("memo text exceeds 28 bytes")

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

// NormalizeMemoText validates and normalizes a MEMO_TEXT value. It enforces the
// strict 28-byte limit (counting UTF-8 bytes via len(s), not runes) before any
// numeric parsing is attempted, returning ErrMemoTooLong for oversized inputs.
func NormalizeMemoText(s string) (string, error) {
	return normalizeMemo(s)
}

// normalizeMemo is the internal implementation of MEMO_TEXT validation.
// It enforces the 28-byte limit by counting raw UTF-8 bytes, not Unicode
// code points, matching the Stellar protocol byte-length rule. High Unicode
// code points encoded as multi-byte UTF-8 sequences are therefore subject to
// the same byte budget as ASCII characters.
func normalizeMemo(s string) (string, error) {
	if len(s) > maxMemoTextBytes {
		return "", ErrMemoTooLong
	}
	return s, nil
}

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

// IsBlankMemoText reports whether a MEMO_TEXT value carries no content: ""
// or only ASCII whitespace (space, tab, LF, CR), per spec/README.md rule 5.
//
// Non-ASCII whitespace such as U+00A0 is content, not blank, so it is still
// reported as an unroutable MEMO_TEXT. Shared with core-ts
// (isBlankMemoText) and core-dart (isBlankMemoText).
func IsBlankMemoText(value string) bool {
	for i := 0; i < len(value); i++ {
		switch value[i] {
		case ' ', '\t', '\n', '\r':
		default:
			return false
		}
	}
	return true
}

// EffectiveMemoType resolves the memo type routing actually acts on. A blank
// MEMO_TEXT (see IsBlankMemoText) is the same as no memo, so it resolves to
// MemoTypeNone: no routing ID and no memo warnings, for G and M destinations
// alike. Every other memo type is returned unchanged.
//
// Normative cases live in spec/vectors/empty-memos.json.
func EffectiveMemoType(memoType, memoValue string) MemoType {
	if memoType == string(MemoTypeText) && IsBlankMemoText(memoValue) {
		return MemoTypeNone
	}
	return MemoType(memoType)
}
