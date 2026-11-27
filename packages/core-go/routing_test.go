package core

import (
	"encoding/base32"
	"testing"
)

func TestParseDepositDestination(t *testing.T) {
	// Valid deposit destination (example address)
	valid := "GD5DJQDKEHXQ7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7"
	if _, err := ParseDepositDestination(valid); err != nil {
		t.Fatalf("expected valid destination, got error: %v", err)
	}

	// Invalid checksum
	invalid := "GD5DJQDKEHXQ7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7"
	if _, err := ParseDepositDestination(invalid); err == nil {
		t.Fatal("expected error for invalid destination")
	}
}

func TestParseDepositDestinationBytes(t *testing.T) {
	valid := "GD5DJQDKEHXQ7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7"
	if _, err := ParseDepositDestinationBytes([]byte(valid)); err != nil {
		t.Fatalf("expected valid destination, got error: %v", err)
	}

	if _, err := ParseDepositDestinationBytes([]byte("not-a-valid-address")); err == nil {
		t.Fatal("expected error for invalid destination")
	}
}

func BenchmarkParseDepositDestinationBytes(b *testing.B) {
	valid := []byte("GD5DJQDKEHXQ7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7")
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := ParseDepositDestinationBytes(valid); err != nil {
			b.Fatalf("unexpected error: %v", err)
		}
	}
}

func BenchmarkParseDepositDestination(b *testing.B) {
	valid := "GD5DJQDKEHXQ7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7Q7"
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := ParseDepositDestination(valid); err != nil {
			b.Fatalf("unexpected error: %v", err)
		}
	}
}

// ensure base32 import is used for potential future zero-copy helpers
var _ = base32.StdEncoding
