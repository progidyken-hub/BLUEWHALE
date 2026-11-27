package strkey

import (
	"bytes"
	"encoding/base32"
	"errors"
	"math/rand"
	"strings"
	"testing"
)

var stdEnc = base32.StdEncoding.WithPadding(base32.NoPadding)

// strkeyM is a 69-character muxed address: 8 full blocks plus a 5-char tail.
const strkeyM = "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG"

func TestDecodeMatchesStdlib(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	for n := 0; n <= 64; n++ {
		for iter := 0; iter < 20; iter++ {
			raw := make([]byte, n)
			rng.Read(raw)
			enc := stdEnc.EncodeToString(raw)

			for _, in := range []string{enc, strings.ToLower(enc)} {
				dst := make([]byte, DecodedLen(len(in)))
				got, err := Decode(dst, in)
				if err != nil {
					t.Fatalf("Decode(%q): %v", in, err)
				}
				if !bytes.Equal(dst[:got], raw) {
					t.Fatalf("Decode(%q) = %x, want %x", in, dst[:got], raw)
				}
			}
		}
	}
}

func TestDecodeErrors(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want error
	}{
		{"length 1", "A", ErrInvalidLength},
		{"length 3", "AAA", ErrInvalidLength},
		{"length 6", "AAAAAA", ErrInvalidLength},
		{"length 9", "AAAAAAAAA", ErrInvalidLength},
		{"invalid char in block", "AAAA1AAA", ErrInvalidCharacter},
		{"padding char in block", "AAAAAAA=", ErrInvalidCharacter},
		{"high byte in block", "AAAAAAA\xff", ErrInvalidCharacter},
		{"invalid char in tail", "AAAAAAAAA8", ErrInvalidCharacter},
		{"nul in tail", "AAAAAAAAAAA\x00", ErrInvalidCharacter},
		{"tail 2 spare bits", "AB", ErrNonZeroPadding},
		{"tail 4 spare bits", "AAAB", ErrNonZeroPadding},
		{"tail 5 spare bits", "AAAAB", ErrNonZeroPadding},
		{"tail 7 spare bits", "AAAAAAB", ErrNonZeroPadding},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dst := make([]byte, 64)
			if _, err := Decode(dst, tt.in); !errors.Is(err, tt.want) {
				t.Fatalf("Decode(%q) err = %v, want %v", tt.in, err, tt.want)
			}
		})
	}
}

func TestDecodeShortBuffer(t *testing.T) {
	dst := make([]byte, DecodedLen(len(strkeyM))-1)
	if _, err := Decode(dst, strkeyM); !errors.Is(err, ErrShortBuffer) {
		t.Fatalf("err = %v, want ErrShortBuffer", err)
	}
}

func TestDecodeEveryTailLength(t *testing.T) {
	// Exercise each valid partial-block length on its own and after a full
	// block, with the largest values whose spare bits are still zero.
	for _, n := range []int{1, 2, 3, 4, 6, 9, 11} {
		raw := bytes.Repeat([]byte{0xff}, n)
		enc := stdEnc.EncodeToString(raw)
		dst := make([]byte, DecodedLen(len(enc)))
		got, err := Decode(dst, enc)
		if err != nil || !bytes.Equal(dst[:got], raw) {
			t.Fatalf("Decode(%q) = %x, %v; want %x", enc, dst[:got], err, raw)
		}
	}
}

func TestDecodeZeroAllocs(t *testing.T) {
	if testing.CoverMode() != "" {
		t.Skip("coverage instrumentation adds allocations")
	}
	var dst [64]byte
	allocs := testing.AllocsPerRun(1000, func() {
		if _, err := Decode(dst[:], strkeyM); err != nil {
			t.Fatal(err)
		}
	})
	if allocs != 0 {
		t.Fatalf("Decode allocated %.1f times per call, want 0", allocs)
	}
}

// FuzzDecode checks Decode against encoding/base32: whatever Decode accepts
// must re-encode to the (uppercased) input, and any canonical uppercase input
// the standard library round-trips must be accepted with the same bytes.
func FuzzDecode(f *testing.F) {
	for _, s := range []string{"", "AA", "MZXW6", "MZXW6YQ", strkeyM, "AB", "a1"} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, in string) {
		dst := make([]byte, DecodedLen(len(in)))
		n, err := Decode(dst, in)

		if err == nil {
			if re := stdEnc.EncodeToString(dst[:n]); re != strings.ToUpper(in) {
				t.Fatalf("Decode(%q) = %x, which re-encodes to %q", in, dst[:n], re)
			}
			return
		}

		want, stdErr := stdEnc.DecodeString(in)
		if stdErr == nil && stdEnc.EncodeToString(want) == in {
			t.Fatalf("Decode(%q) rejected canonical input: %v", in, err)
		}
	})
}

// Benchmarks compare the unrolled decoder against encoding/base32 and
// against the bit-accumulator loop it replaces, on a 69-character M-address:
//
//	go test -run '^$' -bench . -benchmem ./strkey

var benchSink int

func BenchmarkDecodeUnrolled(b *testing.B) {
	var dst [64]byte
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		n, err := Decode(dst[:], strkeyM)
		if err != nil {
			b.Fatal(err)
		}
		benchSink += n
	}
}

func BenchmarkDecodeStdlib(b *testing.B) {
	// encoding/base32 takes []byte; convert once so the conversion is not
	// charged to the standard library.
	src := []byte(strkeyM)
	var dst [64]byte
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		n, err := stdEnc.Decode(dst[:], src)
		if err != nil {
			b.Fatal(err)
		}
		benchSink += n
	}
}

func BenchmarkDecodeAccumulatorLoop(b *testing.B) {
	var dst [64]byte
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		benchSink += decodeAccumulator(dst[:], strkeyM)
	}
}

// decodeAccumulator is the previous one-character-at-a-time loop, kept as a
// benchmark baseline. Error handling is omitted.
func decodeAccumulator(dst []byte, src string) int {
	var acc uint32
	var bits uint
	n := 0
	for i := 0; i < len(src); i++ {
		acc = acc<<5 | uint32(decodeMap[src[i]])
		bits += 5
		if bits >= 8 {
			bits -= 8
			dst[n] = byte(acc >> bits)
			n++
		}
	}
	return n
}
