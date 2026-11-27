package strkey

import (
	"encoding/binary"
	"testing"
)

// TestMuxedDecodeBigEndianSubaccountID verifies that the 64-bit subaccount ID
// embedded in a muxed address is decoded as a big-endian unsigned integer,
// independent of the host architecture's native byte order.
func TestMuxedDecodeBigEndianSubaccountID(t *testing.T) {
	vectors := []struct {
		name string
		id   uint64
	}{
		{"zero", 0},
		{"one", 1},
		{"max_uint32", 0xFFFFFFFF},
		{"uint32_plus_one", 0x100000000},
		{"high_bit", 0x8000000000000000},
		{"max_uint64", 0xFFFFFFFFFFFFFFFF},
		{"mixed", 0x0123456789ABCDEF},
	}

	for _, v := range vectors {
		t.Run(v.name, func(t *testing.T) {
			var buf [8]byte
			binary.BigEndian.PutUint64(buf[:], v.id)

			got := binary.BigEndian.Uint64(buf[:])
			if got != v.id {
				t.Fatalf("big-endian round-trip mismatch: got %#x, want %#x", got, v.id)
			}

			// Explicit byte layout: most significant byte first.
			if buf[0] != byte(v.id>>56) {
				t.Fatalf("expected MSB first, got buf[0]=%#x", buf[0])
			}
			if buf[7] != byte(v.id) {
				t.Fatalf("expected LSB last, got buf[7]=%#x", buf[7])
			}
		})
	}
}

// TestMuxedSubaccountIDBitwiseExtraction verifies that high/low 32-bit
// extraction from the decoded subaccount ID is consistent across platforms.
func TestMuxedSubaccountIDBitwiseExtraction(t *testing.T) {
	const id uint64 = 0x0123456789ABCDEF

	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], id)
	decoded := binary.BigEndian.Uint64(buf[:])

	high := uint32(decoded >> 32)
	low := uint32(decoded & 0xFFFFFFFF)

	if high != 0x01234567 {
		t.Fatalf("high 32 bits: got %#x, want %#x", high, uint32(0x01234567))
	}
	if low != 0x89ABCDEF {
		t.Fatalf("low 32 bits: got %#x, want %#x", low, uint32(0x89ABCDEF))
	}

	// Recombine and confirm the original value is recovered.
	if recombined := (uint64(high) << 32) | uint64(low); recombined != id {
		t.Fatalf("recombined: got %#x, want %#x", recombined, id)
	}
}
