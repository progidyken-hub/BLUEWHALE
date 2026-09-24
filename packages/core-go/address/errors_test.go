package address

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"
)

// TestErrorCodes_MatchSchema guards cross-SDK parity: the canonical codes
// must equal the errorCode enum in spec/schema.json, which TypeScript
// AddressParseErrorCode and Dart AddressErrorCode are also checked against.
func TestErrorCodes_MatchSchema(t *testing.T) {
	data, err := os.ReadFile("../../../spec/schema.json")
	if err != nil {
		t.Fatalf("failed to read schema.json: %v", err)
	}
	var schema struct {
		Definitions struct {
			ErrorCode struct {
				Enum []string `json:"enum"`
			} `json:"errorCode"`
		} `json:"definitions"`
	}
	if err := json.Unmarshal(data, &schema); err != nil {
		t.Fatalf("failed to unmarshal schema.json: %v", err)
	}

	got := make([]string, len(AllErrorCodes))
	for i, c := range AllErrorCodes {
		got[i] = string(c)
	}
	if !reflect.DeepEqual(got, schema.Definitions.ErrorCode.Enum) {
		t.Fatalf("AllErrorCodes = %v, schema errorCode enum = %v", got, schema.Definitions.ErrorCode.Enum)
	}
}

func TestErrorCode_IsValid(t *testing.T) {
	for _, c := range AllErrorCodes {
		if !c.IsValid() {
			t.Errorf("%q should be valid", c)
		}
	}
	for _, c := range []ErrorCode{"", "invalid_checksum", "UNKNOWN"} {
		if c.IsValid() {
			t.Errorf("%q should be invalid", c)
		}
	}
}

func TestParse_OnlySurfacesCanonicalErrorCodes(t *testing.T) {
	inputs := []string{
		"",
		"XYZ",
		"GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSJ",
		"GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRS",
		"SAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI",
		"alice*example.com",
	}
	for _, input := range inputs {
		_, err := Parse(input)
		if err == nil {
			continue
		}
		var routingErr RoutingError
		if !errors.As(err, &routingErr) {
			t.Errorf("Parse(%q) returned non-RoutingError %T: %v", input, err, err)
			continue
		}
		if !routingErr.Code.IsValid() {
			t.Errorf("Parse(%q) returned non-canonical code %q", input, routingErr.Code)
		}
	}
}
