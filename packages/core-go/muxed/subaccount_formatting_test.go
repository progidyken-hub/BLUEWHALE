package muxed

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"regexp"
	"strconv"
	"testing"
)

var canonicalDecimal = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)

// TestSubaccountFormattingVectors runs spec/vectors/subaccount-formatting.json.
// uint64 IDs must be formatted with strconv.FormatUint(v, 10), never through
// float64 (fmt %v / %g would print 1e+18 or round above 2^53).
func TestSubaccountFormattingVectors(t *testing.T) {
	raw, err := os.ReadFile("../../../spec/vectors/subaccount-formatting.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Cases []struct {
			Description string `json:"description"`
			Input       struct {
				BaseG string `json:"base_g"`
				IDHex string `json:"id_hex"`
			} `json:"input"`
			Expected struct {
				Decimal  string `json:"decimal"`
				MAddress string `json:"mAddress"`
			} `json:"expected"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}

	sawMax := false
	for _, tc := range f.Cases {
		tc := tc
		t.Run(tc.Description, func(t *testing.T) {
			b, err := hex.DecodeString(tc.Input.IDHex)
			if err != nil || len(b) != 8 {
				t.Fatalf("id_hex %q is not 8 bytes: %v", tc.Input.IDHex, err)
			}
			id := binary.BigEndian.Uint64(b)
			if id == math.MaxUint64 {
				sawMax = true
			}

			got := strconv.FormatUint(id, 10)
			if got != tc.Expected.Decimal {
				t.Fatalf("FormatUint = %s, want %s", got, tc.Expected.Decimal)
			}
			if !canonicalDecimal.MatchString(got) {
				t.Fatalf("%q is not a canonical decimal string", got)
			}

			parsed, err := strconv.ParseUint(tc.Expected.Decimal, 10, 64)
			if err != nil || parsed != id {
				t.Fatalf("ParseUint(%s) = %d, %v; want %d", tc.Expected.Decimal, parsed, err, id)
			}

			m, err := EncodeMuxed(tc.Input.BaseG, got)
			if err != nil || m != tc.Expected.MAddress {
				t.Fatalf("EncodeMuxed = %s, %v; want %s", m, err, tc.Expected.MAddress)
			}
			baseG, decodedID, err := DecodeMuxed(tc.Expected.MAddress)
			if err != nil || baseG != tc.Input.BaseG || strconv.FormatUint(decodedID, 10) != tc.Expected.Decimal {
				t.Fatalf("DecodeMuxed = (%s, %d, %v)", baseG, decodedID, err)
			}
		})
	}
	if !sawMax {
		t.Error("vectors must include 2^64-1")
	}
}
