// Package intern provides a string intern table for frequent Stellar asset
// codes and issuer addresses.
//
// In a high-throughput payment stream the same short strings — "XLM", "USDC",
// "EURC", and their corresponding G-address issuers — appear in thousands of
// consecutive operations. Without interning, every call that extracts these
// strings from a decoded operation allocates a new heap object even though the
// value is identical to one already in memory.
//
// InternAssetString returns the same string value for equal inputs. Because Go
// strings are immutable value types, all callers that share the same underlying
// array benefit from reduced GC scanning pressure and improved cache locality.
//
// The table is backed by a sync.Map so it is safe for concurrent use without
// external locking. Entries are never evicted; in practice the number of
// distinct asset codes on Stellar mainnet is small (< 10 000) so unbounded
// growth is not a concern for the targeted use-case.
package intern

import "sync"

var table sync.Map // key: string, value: string

// InternAssetString returns a canonical string reference for value. Subsequent
// calls with an equal string return the same value that was stored on the first
// call, so the caller can rely on pointer equality for fast deduplication.
//
// Empty strings are returned immediately without being stored.
func InternAssetString(value string) string {
	if value == "" {
		return value
	}

	// LoadOrStore is a single atomic operation: it stores value if the key is
	// absent and always returns the canonical entry for that key.
	actual, _ := table.LoadOrStore(value, value)
	return actual.(string)
}
