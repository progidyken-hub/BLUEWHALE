package routing

import "testing"

// Cross-language parity benchmark (Go leg). See
// packages/core-go/address/parity_bench_test.go.
func BenchmarkParity_extract_routing_memo_id(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = ExtractRouting(RoutingInput{
			Destination: "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI",
			MemoType:    "id",
			MemoValue:   "9007199254740993",
		})
	}
}
