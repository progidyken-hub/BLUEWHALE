//go:build race

package corego

// raceEnabled reports whether the race detector is on. It drops a share of
// sync.Pool puts at random, which makes allocation counts unreliable.
const raceEnabled = true
