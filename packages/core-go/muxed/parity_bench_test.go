package muxed

import "testing"

// Cross-language parity benchmark (Go leg). See
// packages/core-go/address/parity_bench_test.go.
const parityMAddress = "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG"

func BenchmarkParity_decode_muxed(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _, _ = DecodeMuxed(parityMAddress)
	}
}
