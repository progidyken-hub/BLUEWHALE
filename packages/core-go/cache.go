package core

import (
	"container/list"
	"hash/fnv"
	"sync"
	"time"
)

// CacheConfig configures the validated Stellar G-address cache.
type CacheConfig struct {
	// Capacity is the maximum number of addresses retained across all shards.
	// Values <= 0 fall back to DefaultCacheCapacity.
	Capacity int
	// TTL is the maximum age of a cached entry. Zero disables expiration.
	TTL time.Duration
	// Shards is the number of independent lock-protected shards.
	// Values <= 0 fall back to DefaultCacheShards.
	Shards int
}

const (
	// DefaultCacheCapacity is the default total number of cached addresses.
	DefaultCacheCapacity = 1024
	// DefaultCacheShards is the default number of cache shards.
	DefaultCacheShards = 16
)

// AddressCache is a high-concurrency LRU cache for validated Stellar
// G-addresses. Keys are distributed across shards, each guarded by its own
// sync.RWMutex and LRU list, so concurrent readers and writers rarely contend.
type AddressCache struct {
	ttl    time.Duration
	shards []*cacheShard
}

type cacheEntry struct {
	key     string
	expires time.Time
}

type cacheShard struct {
	mu       sync.RWMutex
	capacity int
	ll       *list.List
	items    map[string]*list.Element
}

// NewAddressCache builds an AddressCache from cfg.
func NewAddressCache(cfg CacheConfig) *AddressCache {
	capacity := cfg.Capacity
	if capacity <= 0 {
		capacity = DefaultCacheCapacity
	}
	shards := cfg.Shards
	if shards <= 0 {
		shards = DefaultCacheShards
	}
	if shards > capacity {
		shards = capacity
	}

	perShard := capacity / shards
	if perShard < 1 {
		perShard = 1
	}

	c := &AddressCache{
		ttl:    cfg.TTL,
		shards: make([]*cacheShard, shards),
	}
	for i := range c.shards {
		c.shards[i] = &cacheShard{
			capacity: perShard,
			ll:       list.New(),
			items:    make(map[string]*list.Element, perShard),
		}
	}
	return c
}

func (c *AddressCache) shardFor(key string) *cacheShard {
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	return c.shards[int(h.Sum32())%len(c.shards)]
}

// Get reports whether key is present and unexpired, refreshing its LRU
// position on a hit.
func (c *AddressCache) Get(key string) bool {
	s := c.shardFor(key)

	s.mu.RLock()
	el, ok := s.items[key]
	if ok {
		entry := el.Value.(*cacheEntry)
		if c.ttl > 0 && time.Now().After(entry.expires) {
			ok = false
		}
	}
	s.mu.RUnlock()

	if !ok {
		if el != nil {
			c.remove(s, key)
		}
		return false
	}

	s.mu.Lock()
	if el, ok := s.items[key]; ok {
		s.ll.MoveToFront(el)
	}
	s.mu.Unlock()
	return true
}

// Add stores key as a validated address, evicting the least recently used
// entry when the shard is full.
func (c *AddressCache) Add(key string) {
	s := c.shardFor(key)

	var expires time.Time
	if c.ttl > 0 {
		expires = time.Now().Add(c.ttl)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if el, ok := s.items[key]; ok {
		el.Value.(*cacheEntry).expires = expires
		s.ll.MoveToFront(el)
		return
	}

	el := s.ll.PushFront(&cacheEntry{key: key, expires: expires})
	s.items[key] = el

	for s.ll.Len() > s.capacity {
		back := s.ll.Back()
		if back == nil {
			break
		}
		entry := back.Value.(*cacheEntry)
		s.ll.Remove(back)
		delete(s.items, entry.key)
	}
}

// Remove drops key from the cache.
func (c *AddressCache) Remove(key string) {
	c.remove(c.shardFor(key), key)
}

func (c *AddressCache) remove(s *cacheShard, key string) {
	s.mu.Lock()
	if el, ok := s.items[key]; ok {
		s.ll.Remove(el)
		delete(s.items, key)
	}
	s.mu.Unlock()
}

// Len returns the total number of entries currently cached.
func (c *AddressCache) Len() int {
	total := 0
	for _, s := range c.shards {
		s.mu.RLock()
		total += len(s.items)
		s.mu.RUnlock()
	}
	return total
}
