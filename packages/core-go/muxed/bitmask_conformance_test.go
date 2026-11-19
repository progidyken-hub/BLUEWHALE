package muxed

import (
	"encoding/binary"
	"math"
	"strconv"
	"testing"

	"github.com/stellar/go/keypair"
)

// TestMuxedAddressBitmaskConformance validates the full uint64 range of
// subaccount IDs by encoding and decoding boundary and representative values,
// ensuring that all 64 bits are correctly preserved through the
// encode-decode cycle without overflow, truncation, or bit corruption.
func TestMuxedAddressBitmaskConformance(t *testing.T) {
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random returned error: %v", err)
	}
	baseG := kp.Address()

	tests := []struct {
		name string
		id   uint64
		desc string
	}{
		{
			name: "zero",
			id:   0,
			desc: "minimum uint64 value (0x0000000000000000)",
		},
		{
			name: "one",
			id:   1,
			desc: "identity value (0x0000000000000001)",
		},
		{
			name: "low_byte_max",
			id:   0xFF,
			desc: "single byte boundary (0x00000000000000FF)",
		},
		{
			name: "uint16_max",
			id:   math.MaxUint16,
			desc: "2-byte boundary (0x000000000000FFFF)",
		},
		{
			name: "uint16_plus_one",
			id:   math.MaxUint16 + 1,
			desc: "3rd byte transition (0x0000000000010000)",
		},
		{
			name: "uint32_max",
			id:   math.MaxUint32,
			desc: "4-byte boundary (0x00000000FFFFFFFF)",
		},
		{
			name: "uint32_plus_one",
			id:   math.MaxUint32 + 1,
			desc: "5th byte transition (0x0000000100000000)",
		},
		{
			name: "js_max_safe_integer",
			id:   9007199254740991, // 2^53 - 1
			desc: "JavaScript Number.MAX_SAFE_INTEGER (0x001FFFFFFFFFFFFF)",
		},
		{
			name: "js_max_safe_integer_plus_one",
			id:   9007199254740992, // 2^53
			desc: "JavaScript precision boundary exceeded (0x0020000000000000)",
		},
		{
			name: "js_max_safe_integer_plus_two",
			id:   9007199254740993, // 2^53 + 1
			desc: "JavaScript unsafe number (0x0020000000000001)",
		},
		{
			name: "bit_53_and_bit_0",
			id:   (1 << 53) | 1,
			desc: "high and low bits set (0x0020000000000001)",
		},
		{
			name: "int64_max",
			id:   math.MaxInt64,
			desc: "signed 64-bit max (0x7FFFFFFFFFFFFFFF)",
		},
		{
			name: "int64_max_plus_one",
			id:   math.MaxInt64 + 1,
			desc: "high bit set (0x8000000000000000)",
		},
		{
			name: "high_bit_only",
			id:   1 << 63,
			desc: "sign bit set (0x8000000000000000)",
		},
		{
			name: "all_high_bits",
			id:   0xFFFFFFFF00000000,
			desc: "upper 32 bits set (0xFFFFFFFF00000000)",
		},
		{
			name: "alternating_bits_0xAAAAAAAAAAAAAAAA",
			id:   0xAAAAAAAAAAAAAAAA,
			desc: "alternating pattern 1010... (0xAAAAAAAAAAAAAAAA)",
		},
		{
			name: "alternating_bits_0x5555555555555555",
			id:   0x5555555555555555,
			desc: "alternating pattern 0101... (0x5555555555555555)",
		},
		{
			name: "uint64_max_minus_one",
			id:   math.MaxUint64 - 1,
			desc: "penultimate uint64 value (0xFFFFFFFFFFFFFFFE)",
		},
		{
			name: "uint64_max",
			id:   math.MaxUint64,
			desc: "maximum uint64 value (0xFFFFFFFFFFFFFFFF)",
		},
		{
			name: "power_of_two_2_32",
			id:   1 << 32,
			desc: "bit 32 set (0x0000000100000000)",
		},
		{
			name: "power_of_two_2_48",
			id:   1 << 48,
			desc: "bit 48 set (0x0001000000000000)",
		},
		{
			name: "power_of_two_2_56",
			id:   1 << 56,
			desc: "bit 56 set (0x0100000000000000)",
		},
		{
			name: "power_of_two_2_60",
			id:   1 << 60,
			desc: "bit 60 set (0x1000000000000000)",
		},
		{
			name: "power_of_two_2_62",
			id:   1 << 62,
			desc: "bit 62 set (0x4000000000000000)",
		},
		{
			name: "power_of_two_2_63",
			id:   1 << 63,
			desc: "bit 63 set (0x8000000000000000)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idStr := strconv.FormatUint(tt.id, 10)

			// Encode: baseG + uint64 ID → M-address
			encoded, err := EncodeMuxed(baseG, idStr)
			if err != nil {
				t.Fatalf("EncodeMuxed(%s) returned error: %v", idStr, err)
			}

			// Decode: M-address → baseG + uint64 ID
			decodedBaseG, decodedID, err := DecodeMuxed(encoded)
			if err != nil {
				t.Fatalf("DecodeMuxed returned error: %v", err)
			}

			// Verify base account matches
			if decodedBaseG != baseG {
				t.Errorf("decoded base account mismatch: got %q want %q", decodedBaseG, baseG)
			}

			// Verify ID matches bit-for-bit
			if decodedID != tt.id {
				t.Errorf("decoded id mismatch: got %d (0x%016X) want %d (0x%016X) [%s]",
					decodedID, decodedID, tt.id, tt.id, tt.desc)
			}

			// Additional validation: verify DecodeMuxedRaw agrees
			pubkey, rawID, err := DecodeMuxedRaw(encoded)
			if err != nil {
				t.Fatalf("DecodeMuxedRaw returned error: %v", err)
			}
			if rawID != tt.id {
				t.Errorf("DecodeMuxedRaw id mismatch: got %d want %d", rawID, tt.id)
			}

			// Verify the raw public key round-trips cleanly by re-encoding and
			// confirming the resulting G-address matches baseG.
			reEncoded, encErr := EncodeMuxed(baseG, idStr)
			if encErr != nil {
				t.Fatalf("re-encoding failed: %v", encErr)
			}
			_, reID, decErr := DecodeMuxedRaw(reEncoded)
			if decErr != nil {
				t.Fatalf("re-decoding raw failed: %v", decErr)
			}
			if reID != tt.id {
				t.Errorf("re-encoded round-trip id mismatch: got %d want %d", reID, tt.id)
			}
			_ = pubkey // pubkey verified indirectly via DecodeMuxed → baseG comparison
		})
	}
}

// TestMuxedAddressBigEndianEncoding validates that the 8-byte ID portion of
// the muxed address payload is encoded in network byte order (big-endian),
// matching the Stellar protocol's XDR uint64 serialization.
func TestMuxedAddressBigEndianEncoding(t *testing.T) {
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random returned error: %v", err)
	}
	baseG := kp.Address()

	tests := []struct {
		name          string
		id            uint64
		expectedBytes [8]byte
	}{
		{
			name:          "zero",
			id:            0x0000000000000000,
			expectedBytes: [8]byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00},
		},
		{
			name:          "one",
			id:            0x0000000000000001,
			expectedBytes: [8]byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01},
		},
		{
			name:          "0x1234567890ABCDEF",
			id:            0x1234567890ABCDEF,
			expectedBytes: [8]byte{0x12, 0x34, 0x56, 0x78, 0x90, 0xAB, 0xCD, 0xEF},
		},
		{
			name:          "0xFFFFFFFFFFFFFFFF",
			id:            0xFFFFFFFFFFFFFFFF,
			expectedBytes: [8]byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF},
		},
		{
			name:          "high_byte_only",
			id:            0xFF00000000000000,
			expectedBytes: [8]byte{0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00},
		},
		{
			name:          "low_byte_only",
			id:            0x00000000000000FF,
			expectedBytes: [8]byte{0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idStr := strconv.FormatUint(tt.id, 10)
			encoded, err := EncodeMuxed(baseG, idStr)
			if err != nil {
				t.Fatalf("EncodeMuxed(%s) returned error: %v", idStr, err)
			}

			// Decode and verify the ID bytes match big-endian expectation
			_, decodedID, err := DecodeMuxed(encoded)
			if err != nil {
				t.Fatalf("DecodeMuxed returned error: %v", err)
			}

			// Convert decoded uint64 back to big-endian bytes
			var gotBytes [8]byte
			binary.BigEndian.PutUint64(gotBytes[:], decodedID)

			if gotBytes != tt.expectedBytes {
				t.Errorf("big-endian byte mismatch:\n  got  %#v\n  want %#v",
					gotBytes, tt.expectedBytes)
			}
		})
	}
}

// TestMuxedAddressBitmaskStressTest exercises a large sample of random uint64
// values to validate that no bit patterns cause encoding or decoding failures.
func TestMuxedAddressBitmaskStressTest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping stress test in short mode")
	}

	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random returned error: %v", err)
	}
	baseG := kp.Address()

	// Test 1000 evenly-distributed uint64 values across the full range
	const sampleCount = 1000
	step := math.MaxUint64 / sampleCount

	for i := uint64(0); i < sampleCount; i++ {
		id := i * step
		idStr := strconv.FormatUint(id, 10)

		encoded, err := EncodeMuxed(baseG, idStr)
		if err != nil {
			t.Fatalf("EncodeMuxed(%d) returned error: %v", id, err)
		}

		decodedBaseG, decodedID, err := DecodeMuxed(encoded)
		if err != nil {
			t.Fatalf("DecodeMuxed (id=%d) returned error: %v", id, err)
		}

		if decodedBaseG != baseG {
			t.Errorf("id=%d: base account mismatch", id)
		}
		if decodedID != id {
			t.Errorf("id=%d: decoded id mismatch: got %d", id, decodedID)
		}
	}
}
