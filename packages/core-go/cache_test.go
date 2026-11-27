package core

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestAddressCacheAddGet(t *testing.T) {
	c := NewAddressCache(CacheConfig{Capacity: 8, Shards: 2})
	if c.Get("GABC") {
		t.Fatal("expected miss on empty cache")
	}
	c.Add("GABC")
	if !c.Get("GABC") {
		t.Fatal("expected hit after Add")
	}
	c.Remove("GABC")
	if c.Get("GABC") {
		t.Fatal("expected miss after Remove")
	}
}

func TestAddressCacheEviction(t *testing.T) {
	c := NewAddressCache(CacheConfig{Capacity: 4, Shards: 1})
	for i := 0; i < 4; i++ {
		c.Add(fmt.Sprintf("G%d", i))
	}
	c.Add("G4")
	if c.Len() != 4 {
		t.Fatalf("expected 4 entries, got %d", c.Len())
	}
	if c.Get("G0") {
		t.Fatal("expected least recently used entry to be evicted")
	}
}

func TestAddressCacheTTL(t *testing.T) {
	c := NewAddressCache(CacheConfig{Capacity: 4, Shards: 1, TTL: 10 * time.Millisecond})
	c.Add("GABC")
	if !c.Get("GABC") {
		t.Fatal("expected hit before TTL expiry")
	}
	time.Sleep(20 * time.Millisecond)
	if c.Get("GABC") {
		t.Fatal("expected miss after TTL expiry")
	}
}

func BenchmarkCacheConcurrent(b *testing.B) {
	c := NewAddressCache(CacheConfig{Capacity: 4096, Shards: 16, TTL: time.Minute})
	keys := make([]string, 256)
	for i := range keys {
		keys[i] = fmt.Sprintf("G%d", i)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := keys[i%len(keys)]
			if i%2 == 0 {
				c.Add(key)
			} else {
				c.Get(key)
			}
			i++
		}
	})
}

var _ = sync.Mutex{}
