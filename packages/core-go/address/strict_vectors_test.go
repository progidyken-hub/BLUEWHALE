package address

import (
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
)

// strkeyVectorFile mirrors the shared spec/vectors/*.json files consumed by
// DecodeStrKeyStrict.
type strkeyVectorFile struct {
	Cases []struct {
		Description string `json:"description"`
		Input       struct {
			Address        string `json:"address"`
			AllowLowercase bool   `json:"allowLowercase"`
		} `json:"input"`
		Expected struct {
			OK         bool   `json:"ok"`
			Error      string `json:"error"`
			Kind       string `json:"kind"`
			Address    string `json:"address"`
			Normalized *bool  `json:"normalized"`
		} `json:"expected"`
	} `json:"cases"`
}

func loadStrkeyVectors(t *testing.T, name string) strkeyVectorFile {
	t.Helper()
	raw, err := os.ReadFile("../../../spec/vectors/" + name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	var f strkeyVectorFile
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parse %s: %v", name, err)
	}
	if len(f.Cases) == 0 {
		t.Fatalf("%s has no cases", name)
	}
	return f
}

// runStrkeyVectors checks every case of f against DecodeStrKeyStrict.
func runStrkeyVectors(t *testing.T, f strkeyVectorFile) {
	t.Helper()
	for _, tc := range f.Cases {
		tc := tc
		t.Run(tc.Description, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("DecodeStrKeyStrict(%q) panicked: %v", tc.Input.Address, r)
				}
			}()

			got, err := DecodeStrKeyStrict(tc.Input.Address, DecodeOptions{AllowLowercase: tc.Input.AllowLowercase})
			if tc.Expected.OK {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if string(got.Kind) != tc.Expected.Kind || got.Address != tc.Expected.Address {
					t.Fatalf("got (%s, %s), want (%s, %s)", got.Kind, got.Address, tc.Expected.Kind, tc.Expected.Address)
				}
				if tc.Expected.Normalized != nil && got.Normalized != *tc.Expected.Normalized {
					t.Fatalf("Normalized = %v, want %v", got.Normalized, *tc.Expected.Normalized)
				}
				return
			}

			var re RoutingError
			if !errors.As(err, &re) {
				t.Fatalf("error %v is not a RoutingError", err)
			}
			if string(re.Code) != tc.Expected.Error {
				t.Fatalf("code = %s, want %s", re.Code, tc.Expected.Error)
			}
		})
	}
}

// TestTruncatedAddressVectors runs spec/vectors/truncated-addresses.json.
func TestTruncatedAddressVectors(t *testing.T) {
	f := loadStrkeyVectors(t, "truncated-addresses.json")
	runStrkeyVectors(t, f)

	seen := map[int]bool{}
	for _, tc := range f.Cases {
		if !tc.Expected.OK && len(tc.Input.Address) < 69 {
			seen[len(tc.Input.Address)] = true
		}
	}

	for n := 10; n <= 68; n++ {
		if !seen[n] {
			t.Errorf("missing truncated vector of length %d", n)
		}
	}
}

// TestCaseSensitivityVectors runs spec/vectors/case-sensitivity.json.
func TestCaseSensitivityVectors(t *testing.T) {
	f := loadStrkeyVectors(t, "case-sensitivity.json")
	runStrkeyVectors(t, f)

	prefixes := map[byte]bool{}
	for _, tc := range f.Cases {
		a := tc.Input.Address
		if !tc.Input.AllowLowercase && !tc.Expected.OK && strings.ContainsAny(a[:1], "gmc") {
			prefixes[a[0]] = true
		}
	}
	for _, p := range []byte("gmc") {
		if !prefixes[p] {
			t.Errorf("missing a rejected lowercase %q... vector", p)
		}
	}
}

// TestDecodeStrKeyStrictRejectsLowercaseByDefault pins the zero-value
// DecodeOptions behaviour.
func TestDecodeStrKeyStrictRejectsLowercaseByDefault(t *testing.T) {
	const g = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI"
	if _, err := DecodeStrKeyStrict(strings.ToLower(g), DecodeOptions{}); !errors.Is(err, ErrInvalidBase32Error) {
		t.Fatalf("err = %v, want INVALID_BASE32", err)
	}
}
