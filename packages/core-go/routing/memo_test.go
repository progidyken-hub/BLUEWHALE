package routing

import (
	"encoding/json"
	"os"
	"strconv"
	"testing"

	"github.com/REDISHFISH/BLUEWHALE/packages/core-go/address"
)

// memoNormalizationFixture mirrors spec/memo_text_normalization.json, which is
// shared with core-ts (src/routing/memo.test.ts) and core-dart
// (test/memo_normalization_test.dart) so all three SDKs stay byte-identical.
type memoNormalizationFixture struct {
	Cases []struct {
		Input      string  `json:"input"`
		Normalized *string `json:"normalized"`
		Warning    *struct {
			Original   string `json:"original"`
			Normalized string `json:"normalized"`
		} `json:"warning"`
	} `json:"cases"`
}

func loadMemoNormalizationFixture(t *testing.T) memoNormalizationFixture {
	t.Helper()
	data, err := os.ReadFile("../../../spec/memo_text_normalization.json")
	if err != nil {
		t.Fatalf("failed to read memo_text_normalization.json: %v", err)
	}
	var fixture memoNormalizationFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to unmarshal memo_text_normalization.json: %v", err)
	}
	if len(fixture.Cases) == 0 {
		t.Fatal("memo_text_normalization.json has no cases")
	}
	return fixture
}

func TestNormalizeMemoTextID_ParityFixture(t *testing.T) {
	fixture := loadMemoNormalizationFixture(t)

	for _, c := range fixture.Cases {
		c := c
		t.Run(strconv.Quote(c.Input), func(t *testing.T) {
			got := NormalizeMemoTextID(c.Input)

			want := ""
			if c.Normalized != nil {
				want = *c.Normalized
			}
			if got.Normalized != want {
				t.Fatalf("Normalized = %q, want %q", got.Normalized, want)
			}

			if c.Warning == nil {
				if len(got.Warnings) != 0 {
					t.Fatalf("expected no warnings, got %+v", got.Warnings)
				}
				return
			}

			if len(got.Warnings) != 1 {
				t.Fatalf("expected exactly 1 warning, got %+v", got.Warnings)
			}
			w := got.Warnings[0]
			if w.Code != address.WarnNonCanonicalRoutingID {
				t.Fatalf("Code = %q, want %q", w.Code, address.WarnNonCanonicalRoutingID)
			}
			if w.Severity != "warn" {
				t.Fatalf("Severity = %q, want %q", w.Severity, "warn")
			}
			if w.Normalization == nil {
				t.Fatal("expected Normalization payload, got nil")
			}
			if w.Normalization.Original != c.Warning.Original {
				t.Fatalf("Original = %q, want %q", w.Normalization.Original, c.Warning.Original)
			}
			if w.Normalization.Normalized != c.Warning.Normalized {
				t.Fatalf("Normalized = %q, want %q", w.Normalization.Normalized, c.Warning.Normalized)
			}
		})
	}
}

func TestExtractRouting_MemoTextNormalization(t *testing.T) {
	t.Run("leading zeros normalize with warning", func(t *testing.T) {
		result := ExtractRouting(RoutingInput{
			Destination: testBaseG,
			MemoType:    "text",
			MemoValue:   "00123",
		})

		if result.RoutingSource != "memo" {
			t.Fatalf("RoutingSource = %q, want memo", result.RoutingSource)
		}
		if result.RoutingID == nil || result.RoutingID.String() != "123" {
			t.Fatalf("RoutingID = %v, want 123", result.RoutingID)
		}
		var found bool
		for _, w := range result.Warnings {
			if w.Code != address.WarnNonCanonicalRoutingID {
				continue
			}
			found = true
			if w.Normalization == nil ||
				w.Normalization.Original != "00123" ||
				w.Normalization.Normalized != "123" {
				t.Fatalf("unexpected normalization payload: %+v", w.Normalization)
			}
		}
		if !found {
			t.Fatalf("expected NON_CANONICAL_ROUTING_ID warning, got %+v", result.Warnings)
		}
	})

	t.Run("surrounding whitespace is unroutable", func(t *testing.T) {
		result := ExtractRouting(RoutingInput{
			Destination: testBaseG,
			MemoType:    "text",
			MemoValue:   " 123 ",
		})

		if result.RoutingSource != "none" || result.RoutingID != nil {
			t.Fatalf("expected unroutable result, got source=%q id=%v", result.RoutingSource, result.RoutingID)
		}
		if len(result.Warnings) != 1 || result.Warnings[0].Code != address.WarnMemoTextUnroutable {
			t.Fatalf("expected single MEMO_TEXT_UNROUTABLE warning, got %+v", result.Warnings)
		}
	})
}
