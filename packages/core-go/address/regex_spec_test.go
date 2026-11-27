package address

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"
)

// TestRegexSpecParity runs every case in spec/regex.json through Go's RE2
// engine. The same cases are asserted in core-ts (src/test/regex-spec.test.ts),
// core-dart (test/regex_spec_test.dart) and, for ECMAScript and PCRE/Perl, in
// scripts/check-regex-spec.js.
func TestRegexSpecParity(t *testing.T) {
	data, err := os.ReadFile("../../../spec/regex.json")
	if err != nil {
		t.Fatalf("read spec/regex.json: %v", err)
	}

	var spec struct {
		Patterns map[string]struct {
			Pattern string `json:"pattern"`
		} `json:"patterns"`
		Cases []struct {
			Pattern     string `json:"pattern"`
			Input       string `json:"input"`
			Match       bool   `json:"match"`
			Description string `json:"description"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(data, &spec); err != nil {
		t.Fatalf("decode spec/regex.json: %v", err)
	}

	compiled := make(map[string]*regexp.Regexp, len(spec.Patterns))
	for name, p := range spec.Patterns {
		re, err := regexp.Compile(p.Pattern)
		if err != nil {
			t.Fatalf("%s: RE2 cannot compile %q: %v", name, p.Pattern, err)
		}
		compiled[name] = re
	}

	for _, c := range spec.Cases {
		re, ok := compiled[c.Pattern]
		if !ok {
			t.Errorf("unknown pattern %q", c.Pattern)
			continue
		}
		if got := re.MatchString(c.Input); got != c.Match {
			t.Errorf("[%s] %s: input %q matched=%v, want %v", c.Pattern, c.Description, c.Input, got, c.Match)
		}
	}
}
