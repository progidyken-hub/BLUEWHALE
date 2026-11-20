package muxed

import (
	"encoding/json"
	"errors"
	"os"
	"testing"
)

// TestDecodeMuxedTruncatedVectors runs the negative cases of
// spec/vectors/truncated-addresses.json through DecodeMuxed and
// DecodeMuxedRaw: both must report INVALID_LENGTH and never panic.
func TestDecodeMuxedTruncatedVectors(t *testing.T) {
	raw, err := os.ReadFile("../../../spec/vectors/truncated-addresses.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Cases []struct {
			Description string            `json:"description"`
			Input       map[string]string `json:"input"`
			Expected    struct {
				OK    bool   `json:"ok"`
				Error string `json:"error"`
			} `json:"expected"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}

	for _, tc := range f.Cases {
		if tc.Expected.OK {
			continue
		}
		tc := tc
		t.Run(tc.Description, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("panicked: %v", r)
				}
			}()
			in := tc.Input["address"]

			_, _, err := DecodeMuxed(in)
			var ae *AddressError
			if !errors.As(err, &ae) || string(ae.Code) != tc.Expected.Error {
				t.Fatalf("DecodeMuxed(%q) err = %v, want code %s", in, err, tc.Expected.Error)
			}
			if _, _, rawErr := DecodeMuxedRaw(in); !errors.As(rawErr, &ae) || string(ae.Code) != tc.Expected.Error {
				t.Fatalf("DecodeMuxedRaw(%q) err = %v, want code %s", in, rawErr, tc.Expected.Error)
			}
		})
	}
}
