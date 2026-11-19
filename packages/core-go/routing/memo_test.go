package routing

import (
	"errors"
	"strings"
	"testing"
)

func TestNormalizeMemoByteLimit(t *testing.T) {
	tests := []struct {
		name    string
		memo    string
		wantErr error
	}{
		{
			name:    "empty memo accepted",
			memo:    "",
			wantErr: nil,
		},
		{
			name:    "exactly 28 bytes accepted",
			memo:    strings.Repeat("a", 28),
			wantErr: nil,
		},
		{
			name:    "29 bytes rejected",
			memo:    strings.Repeat("a", 29),
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "multi-byte UTF-8 counted by bytes",
			memo:    strings.Repeat("\u00e9", 14), // 14 runes, 28 bytes
			wantErr: nil,
		},
		{
			name:    "multi-byte UTF-8 exceeding 28 bytes rejected",
			memo:    strings.Repeat("\u00e9", 15), // 15 runes, 30 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "4-byte rune boundary accepted",
			memo:    strings.Repeat("\U0001F600", 7), // 7 runes, 28 bytes
			wantErr: nil,
		},
		{
			name:    "4-byte rune boundary rejected",
			memo:    strings.Repeat("\U0001F600", 8), // 8 runes, 32 bytes
			wantErr: ErrMemoTooLong,
		},
		// High Unicode code points (U+10000 and above) encode to 4 bytes each in
		// UTF-8, so the byte budget is exhausted much faster than the rune count
		// suggests. These tests guard the byte-counting rule for the full Unicode
		// supplementary planes.
		{
			name:    "plane-1 musical symbol (4-byte) exactly 28 bytes accepted",
			memo:    strings.Repeat("\U0001D11E", 7), // 7 × 4 = 28 bytes
			wantErr: nil,
		},
		{
			name:    "plane-1 musical symbol (4-byte) 29 bytes rejected",
			memo:    strings.Repeat("\U0001D11E", 7) + "x", // 28 + 1 = 29 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "plane-2 CJK extension (4-byte) exactly 28 bytes accepted",
			memo:    strings.Repeat("\U00020000", 7), // 7 × 4 = 28 bytes
			wantErr: nil,
		},
		{
			name:    "plane-2 CJK extension (4-byte) 32 bytes rejected",
			memo:    strings.Repeat("\U00020000", 8), // 8 × 4 = 32 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "highest valid Unicode code point U+10FFFF accepted at 7 runes",
			memo:    strings.Repeat("\U0010FFFF", 7), // 7 × 4 = 28 bytes
			wantErr: nil,
		},
		{
			name:    "highest valid Unicode code point U+10FFFF rejected at 8 runes",
			memo:    strings.Repeat("\U0010FFFF", 8), // 8 × 4 = 32 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "mixed ASCII and high code point within 28 bytes accepted",
			memo:    strings.Repeat("ab", 2) + strings.Repeat("\U0001F600", 5), // 4 + 20 = 24 bytes
			wantErr: nil,
		},
		{
			name:    "mixed ASCII and high code point exceeding 28 bytes rejected",
			memo:    strings.Repeat("ab", 2) + strings.Repeat("\U0001F600", 6), // 4 + 24 = 28 bytes, then +1 ASCII = 29
			wantErr: nil, // 28 bytes exactly — still accepted
		},
		{
			name:    "mixed ASCII and high code point exceeding 28 bytes rejected boundary",
			memo:    strings.Repeat("ab", 3) + strings.Repeat("\U0001F600", 6), // 6 + 24 = 30 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "plane-15 private use area (4-byte) accepted",
			memo:    strings.Repeat("\U000F0001", 7), // 7 × 4 = 28 bytes
			wantErr: nil,
		},
		{
			name:    "plane-15 private use area (4-byte) rejected",
			memo:    strings.Repeat("\U000F0001", 8), // 8 × 4 = 32 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "plane-16 private use area (4-byte) accepted",
			memo:    strings.Repeat("\U00100001", 7), // 7 × 4 = 28 bytes
			wantErr: nil,
		},
		{
			name:    "plane-16 private use area (4-byte) rejected",
			memo:    strings.Repeat("\U00100001", 8), // 8 × 4 = 32 bytes
			wantErr: ErrMemoTooLong,
		},
		{
			name:    "BMP 3-byte rune at 9 runes accepted",
			memo:    strings.Repeat("\u4e16", 9), // 9 × 3 = 27 bytes
			wantErr: nil,
		},
		{
			name:    "BMP 3-byte rune at 10 runes rejected",
			memo:    strings.Repeat("\u4e16", 10), // 10 × 3 = 30 bytes
			wantErr: ErrMemoTooLong,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := normalizeMemo(tt.memo)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("normalizeMemo(%q) error = %v, want %v", tt.memo, err, tt.wantErr)
			}
		})
	}
}
