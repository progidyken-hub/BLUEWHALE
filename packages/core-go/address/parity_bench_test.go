package address

import "testing"

// Cross-language parity benchmarks (Go leg). Workload names and inputs MUST
// stay identical to packages/core-ts/bench/parity.bench.ts and
// packages/core-dart/benchmark/parity_benchmark.dart. Run all three on the
// same host with scripts/run-parity-benchmarks.sh.
const (
	parityGAddress = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI"
	parityMAddress = "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG"
)

func BenchmarkParity_parse_g(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _ = Parse(parityGAddress)
	}
}

func BenchmarkParity_parse_m(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _ = Parse(parityMAddress)
	}
}
