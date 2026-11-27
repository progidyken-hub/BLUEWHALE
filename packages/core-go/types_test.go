package core

import (
	"encoding/json"
	"testing"
)

func TestDestinationTypeJSONRoundTrip(t *testing.T) {
	for _, dt := range []DestinationType{DestinationTypeAccount, DestinationTypeMuxed} {
		data, err := json.Marshal(dt)
		if err != nil {
			t.Fatalf("marshal %v: %v", dt, err)
		}
		if string(data) != `"`+dt.String()+`"` {
			t.Fatalf("expected quoted string, got %s", data)
		}

		var got DestinationType
		if err := json.Unmarshal(data, &got); err != nil {
			t.Fatalf("unmarshal %s: %v", data, err)
		}
		if got != dt {
			t.Fatalf("round-trip mismatch: got %v want %v", got, dt)
		}
	}
}

func TestDestinationTypeTextRoundTrip(t *testing.T) {
	for _, dt := range []DestinationType{DestinationTypeAccount, DestinationTypeMuxed} {
		text, err := dt.MarshalText()
		if err != nil {
			t.Fatalf("marshal text %v: %v", dt, err)
		}
		var got DestinationType
		if err := got.UnmarshalText(text); err != nil {
			t.Fatalf("unmarshal text %s: %v", text, err)
		}
		if got != dt {
			t.Fatalf("text round-trip mismatch: got %v want %v", got, dt)
		}
	}
}

func TestDestinationTypeUnmarshalInvalid(t *testing.T) {
	var dt DestinationType
	if err := json.Unmarshal([]byte(`"bogus"`), &dt); err == nil {
		t.Fatal("expected error for invalid DestinationType")
	}
}
