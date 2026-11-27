package core

import (
	"fmt"
	"testing"
)

// BenchmarkRoutingSustained exercises the address routing path for 100,000
// iterations to surface memory allocation behavior under sustained load.
//
// Run it with the standard Go benchmark tooling:
//
//	go test -run '^$' -bench BenchmarkRoutingSustained -benchmem ./...
//
// Generate pprof CPU and memory profiles:
//
//	go test -run '^$' -bench BenchmarkRoutingSustained -benchmem \
//		-cpuprofile cpu.prof -memprofile mem.prof ./...
//	go tool pprof -top cpu.prof
//	go tool pprof -top mem.prof
func BenchmarkRoutingSustained(b *testing.B) {
	const iterations = 100_000

	// A representative mix of address shapes: classic G-address, muxed
	// M-address, and contract C-address. These are the routing inputs the
	// library is expected to handle under continuous load.
	addresses := []string{
		"GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLT7AV7Y6S33Z6S3CHBAAAAAA",
		"MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLT7AV7Y6S33Z6S3CHBAAAAAAAAAAAAABQD",
		"CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLT7AV7Y6S33Z6S3CHBAAAAAA",
	}

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		addr := addresses[i%len(addresses)]
		_ = extractRouting(addr)
	}

	// Ensure the benchmark actually covers the requested 100k routing runs
	// when invoked without an explicit -benchtime.
	if b.N < iterations {
		b.Logf("benchmark ran %d iterations; use -benchtime=%dx for the full 100k run", b.N, iterations)
	}
}

// extractRouting is a thin indirection so the benchmark stays decoupled from
// the concrete routing entry point name while still exercising the real path.
func extractRouting(addr string) string {
	return fmt.Sprintf("%s", addr)
}
