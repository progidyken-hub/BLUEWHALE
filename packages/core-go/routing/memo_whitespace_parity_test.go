package routing

import "testing"

// Memo whitespace / leading-zero parity suite. The same table is asserted in
// core-ts (src/test/memo-whitespace-parity.test.ts) and core-dart
// (test/memo_whitespace_parity_test.dart).
func TestNormalizeMemoTextIDWhitespaceParity(t *testing.T) {
	cases := []struct {
		input, normalized, warnOriginal, warnNormalized string
		hasWarning                                     bool
	}{
		{" 123 ", "", "", "", false},
		{" 123", "", "", "", false},
		{"123 ", "", "", "", false},
		{"123\n", "", "", "", false},
		{"\t123", "", "", "", false},
		{"1 23", "", "", "", false},
		{"", "", "", "", false},
		{"00123", "123", "00123", "123", true},
		{"000", "0", "000", "0", true},
		{"0", "0", "", "", false},
		{"123", "123", "", "", false},
	}
	for _, tc := range cases {
		r := NormalizeMemoTextID(tc.input)
		if r.Normalized != tc.normalized {
			t.Errorf("%q: normalized = %q, want %q", tc.input, r.Normalized, tc.normalized)
		}
		if !tc.hasWarning {
			if len(r.Warnings) != 0 {
				t.Errorf("%q: unexpected warnings %v", tc.input, r.Warnings)
			}
			continue
		}
		if len(r.Warnings) != 1 || r.Warnings[0].Normalization == nil {
			t.Errorf("%q: want exactly one warning with normalization, got %v", tc.input, r.Warnings)
			continue
		}
		w := r.Warnings[0]
		if string(w.Code) != "NON_CANONICAL_ROUTING_ID" ||
			w.Normalization.Original != tc.warnOriginal ||
			w.Normalization.Normalized != tc.warnNormalized {
			t.Errorf("%q: unexpected warning %+v", tc.input, w)
		}
	}
}
