package strkey

import (
	"crypto/rand"
	"testing"
)

func TestCRC16ChecksumValid(t *testing.T) {
	payload := []byte("hello world")
	checksum := CRC16Checksum(payload)

	if !VerifyChecksum(payload, checksum) {
		t.Fatalf("expected valid checksum to verify")
	}
}

func TestCRC16ChecksumInvalid(t *testing.T) {
	payload := []byte("hello world")
	checksum := CRC16Checksum(payload)

	// Flip a bit in the checksum and ensure verification fails.
	bad := []byte{checksum[0] ^ 0x01, checksum[1]}
	if VerifyChecksum(payload, bad) {
		t.Fatalf("expected corrupted checksum to fail verification")
	}

	// Corrupt the payload and ensure verification fails.
	badPayload := []byte("hello worle")
	if VerifyChecksum(badPayload, checksum) {
		t.Fatalf("expected checksum mismatch to fail verification")
	}
}

func TestCRC16ChecksumWrongLength(t *testing.T) {
	payload := []byte("hello world")
	checksum := CRC16Checksum(payload)

	if VerifyChecksum(payload, checksum[:1]) {
		t.Fatalf("expected short checksum to fail verification")
	}
	if VerifyChecksum(payload, append(checksum, 0x00)) {
		t.Fatalf("expected long checksum to fail verification")
	}
}

func TestCRC16ChecksumRandomRoundTrip(t *testing.T) {
	for i := 0; i < 100; i++ {
		payload := make([]byte, i)
		if _, err := rand.Read(payload); err != nil {
			t.Fatalf("failed to generate random payload: %v", err)
		}

		checksum := CRC16Checksum(payload)
		if !VerifyChecksum(payload, checksum) {
			t.Fatalf("expected valid checksum to verify for payload length %d", i)
		}
	}
}

func BenchmarkVerifyChecksum(b *testing.B) {
	payload := []byte("benchmark payload for crc16 verification")
	checksum := CRC16Checksum(payload)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !VerifyChecksum(payload, checksum) {
			b.Fatal("expected valid checksum to verify")
		}
	}
}
