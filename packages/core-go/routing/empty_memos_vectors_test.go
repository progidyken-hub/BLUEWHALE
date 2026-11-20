package routing

import (
	"encoding/json"
	"os"
	"testing"
)

// TestEmptyMemoVectors runs spec/vectors/empty-memos.json. The same file is
// run by core-ts (src/spec/empty-memos.test.ts) and core-dart
// (test/empty_memos_vectors_test.dart). Go has no null string, so a null or
// omitted memoValue is passed as "".
func TestEmptyMemoVectors(t *testing.T) {
	data, err := os.ReadFile("../../../spec/vectors/empty-memos.json")
	if err != nil {
		t.Fatalf("read empty-memos.json: %v", err)
	}

	var spec struct {
		Cases []struct {
			ID    string `json:"id"`
			Input struct {
				Destination string  `json:"destination"`
				MemoType    string  `json:"memoType"`
				MemoValue   *string `json:"memoValue"`
			} `json:"input"`
			Expected struct {
				EffectiveMemoType      MemoType `json:"effectiveMemoType"`
				DestinationBaseAccount *string  `json:"destinationBaseAccount"`
				RoutingID              *string  `json:"routingId"`
				RoutingSource          string   `json:"routingSource"`
				Warnings               []struct {
					Code     string `json:"code"`
					Severity string `json:"severity"`
				} `json:"warnings"`
			} `json:"expected"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(data, &spec); err != nil {
		t.Fatalf("decode empty-memos.json: %v", err)
	}
	if len(spec.Cases) == 0 {
		t.Fatal("empty-memos.json has no cases")
	}

	for _, c := range spec.Cases {
		t.Run(c.ID, func(t *testing.T) {
			memoValue := ""
			if c.Input.MemoValue != nil {
				memoValue = *c.Input.MemoValue
			}

			if got := EffectiveMemoType(c.Input.MemoType, memoValue); got != c.Expected.EffectiveMemoType {
				t.Errorf("EffectiveMemoType = %q, want %q", got, c.Expected.EffectiveMemoType)
			}
			if c.Input.MemoType == string(MemoTypeText) {
				if got, want := IsBlankMemoText(memoValue), c.Expected.EffectiveMemoType == MemoTypeNone; got != want {
					t.Errorf("IsBlankMemoText(%q) = %v, want %v", memoValue, got, want)
				}
			}

			r := ExtractRouting(RoutingInput{
				Destination: c.Input.Destination,
				MemoType:    c.Input.MemoType,
				MemoValue:   memoValue,
			})

			wantBase := ""
			if c.Expected.DestinationBaseAccount != nil {
				wantBase = *c.Expected.DestinationBaseAccount
			}
			if r.DestinationBaseAccount != wantBase {
				t.Errorf("DestinationBaseAccount = %q, want %q", r.DestinationBaseAccount, wantBase)
			}

			wantID := ""
			if c.Expected.RoutingID != nil {
				wantID = *c.Expected.RoutingID
			}
			if got := r.RoutingID.String(); got != wantID {
				t.Errorf("RoutingID = %q, want %q", got, wantID)
			}
			if r.RoutingSource != c.Expected.RoutingSource {
				t.Errorf("RoutingSource = %q, want %q", r.RoutingSource, c.Expected.RoutingSource)
			}

			if len(r.Warnings) != len(c.Expected.Warnings) {
				t.Fatalf("warnings = %+v, want %+v", r.Warnings, c.Expected.Warnings)
			}
			for i, w := range c.Expected.Warnings {
				if string(r.Warnings[i].Code) != w.Code || r.Warnings[i].Severity != w.Severity {
					t.Errorf("warning[%d] = %s/%s, want %s/%s", i, r.Warnings[i].Code, r.Warnings[i].Severity, w.Code, w.Severity)
				}
			}
		})
	}
}
