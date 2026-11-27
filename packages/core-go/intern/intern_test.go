package intern

import (
	"fmt"
	"sync"
	"testing"
)

func TestInternAssetString_SameReference(t *testing.T) {
	// Two distinct string allocations with the same content must return the
	// same interned value after the first call stores it.
	const code = "USDC"

	a := InternAssetString(code)
	b := InternAssetString(code)

	if a != b {
		t.Errorf("expected identical values, got %q and %q", a, b)
	}
	if a != code {
		t.Errorf("expected %q, got %q", code, a)
	}
}

func TestInternAssetString_EmptyStringPassThrough(t *testing.T) {
	result := InternAssetString("")
	if result != "" {
		t.Errorf("empty string should be returned as-is, got %q", result)
	}
}

func TestInternAssetString_DistinctCodesRetainValues(t *testing.T) {
	codes := []string{"XLM", "USDC", "EURC", "yXLM", "AQUA"}
	for _, code := range codes {
		got := InternAssetString(code)
		if got != code {
			t.Errorf("InternAssetString(%q) = %q, want %q", code, got, code)
		}
	}
}

func TestInternAssetString_IssuerAddress(t *testing.T) {
	const issuer = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI"
	a := InternAssetString(issuer)
	b := InternAssetString(issuer)
	if a != b {
		t.Errorf("expected identical issuer references")
	}
}

func TestInternAssetString_ConcurrentSafety(t *testing.T) {
	// Many goroutines racing to intern the same value must all get equal results.
	const workers = 50
	const code = "CONCURRENT_ASSET"
	results := make([]string, workers)

	var wg sync.WaitGroup
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		i := i
		go func() {
			defer wg.Done()
			results[i] = InternAssetString(code)
		}()
	}
	wg.Wait()

	for i, r := range results {
		if r != code {
			t.Errorf("goroutine %d got %q, want %q", i, r, code)
		}
	}
}

func BenchmarkInternAssetString_HitKnown(b *testing.B) {
	// Pre-seed the table with the most common codes.
	known := []string{"XLM", "USDC", "EURC", "yXLM", "AQUA", "BTC", "ETH", "USDT", "PAXG", "nXLM"}
	for _, c := range known {
		InternAssetString(c)
	}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = InternAssetString(known[i%len(known)])
	}
}

func BenchmarkInternAssetString_Miss(b *testing.B) {
	// Each iteration misses the table (unique key).
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = InternAssetString(fmt.Sprintf("BENCH_%d", i))
	}
}
