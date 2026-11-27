package corego

import (
	"bytes"
	"errors"
	"runtime"
	"testing"

	"github.com/REDISHFISH/BLUEWHALE/packages/core-go/address"
)

const (
	poolTestGAddr = "GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI"
	poolTestMAddr = "MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG"
)

func TestPutDecodeBufferZeroes(t *testing.T) {
	buf := GetDecodeBuffer()
	for i := range buf {
		buf[i] = 0xAB
	}
	PutDecodeBuffer(buf)

	// buf is still addressable here; it must have been cleared before it
	// went back into the pool.
	if *buf != [DecodeBufferSize]byte{} {
		t.Fatalf("PutDecodeBuffer did not zero the buffer: %x", buf[:])
	}
}

func TestGetDecodeBufferIsZeroed(t *testing.T) {
	for i := 0; i < 100; i++ {
		buf := GetDecodeBuffer()
		if *buf != [DecodeBufferSize]byte{} {
			t.Fatalf("GetDecodeBuffer returned dirty buffer: %x", buf[:])
		}
		buf[0] = 0xFF
		PutDecodeBuffer(buf)
	}
}

func TestPutDecodeBufferNil(t *testing.T) {
	PutDecodeBuffer(nil) // must not panic
}

func TestDecodeStrKeyPooled(t *testing.T) {
	for _, in := range []string{poolTestGAddr, poolTestMAddr} {
		wantVersion, wantPayload, err := address.DecodeStrKey(in)
		if err != nil {
			t.Fatalf("DecodeStrKey(%s): %v", in, err)
		}

		err = DecodeStrKeyPooled(in, func(v byte, payload []byte) error {
			if v != wantVersion {
				t.Errorf("version = %#x, want %#x", v, wantVersion)
			}
			if !bytes.Equal(payload, wantPayload) {
				t.Errorf("payload = %x, want %x", payload, wantPayload)
			}
			return nil
		})
		if err != nil {
			t.Fatalf("DecodeStrKeyPooled(%s): %v", in, err)
		}
	}
}

func TestDecodeStrKeyPooledErrors(t *testing.T) {
	called := false
	err := DecodeStrKeyPooled("GAAA", func(byte, []byte) error {
		called = true
		return nil
	})
	if err == nil {
		t.Fatal("expected error for malformed address")
	}
	if called {
		t.Fatal("fn must not be called when decoding fails")
	}

	sentinel := errors.New("boom")
	err = DecodeStrKeyPooled(poolTestGAddr, func(byte, []byte) error { return sentinel })
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want fn's error", err)
	}
}

func TestDecodeStrKeyPooledZeroAllocs(t *testing.T) {
	if testing.CoverMode() != "" || raceEnabled {
		t.Skip("instrumentation adds allocations")
	}
	var sink byte
	fn := func(v byte, payload []byte) error {
		sink ^= v ^ payload[0]
		return nil
	}
	allocs := testing.AllocsPerRun(1000, func() {
		if err := DecodeStrKeyPooled(poolTestMAddr, fn); err != nil {
			t.Fatal(err)
		}
	})
	if allocs != 0 {
		t.Fatalf("DecodeStrKeyPooled allocated %.1f times per call, want 0", allocs)
	}
	_ = sink
}

// The pair of benchmarks below compares a pooled decode loop against one
// that allocates a fresh 64-byte buffer per decode. Besides ns/op and
// allocs/op they report the GC cycles and total stop-the-world pause time
// accumulated per 1M decodes, which is what an exchange's transaction loop
// feels under sustained load:
//
//	go test -run '^$' -bench 'DecodeLoop' -benchmem .

func BenchmarkDecodeLoopPooled(b *testing.B) {
	fn := func(byte, []byte) error { return nil }
	b.ReportAllocs()
	b.ResetTimer()
	gc := startGCStats()
	for i := 0; i < b.N; i++ {
		if err := DecodeStrKeyPooled(poolTestMAddr, fn); err != nil {
			b.Fatal(err)
		}
	}
	gc.report(b)
}

func BenchmarkDecodeLoopAlloc(b *testing.B) {
	b.ReportAllocs()
	b.ResetTimer()
	gc := startGCStats()
	for i := 0; i < b.N; i++ {
		buf := make([]byte, DecodeBufferSize)
		if _, _, err := address.DecodeStrKeyInto(buf, poolTestMAddr); err != nil {
			b.Fatal(err)
		}
		allocSink = buf
	}
	gc.report(b)
}

// allocSink forces the per-iteration buffer in BenchmarkDecodeLoopAlloc onto
// the heap, as it would be when handed to other code in a real loop.
var allocSink []byte

type gcStats struct {
	numGC   uint32
	pauseNs uint64
}

func startGCStats() gcStats {
	runtime.GC()
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return gcStats{m.NumGC, m.PauseTotalNs}
}

func (s gcStats) report(b *testing.B) {
	b.StopTimer()
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	per := 1e6 / float64(b.N)
	b.ReportMetric(float64(m.NumGC-s.numGC)*per, "gc/1M-ops")
	b.ReportMetric(float64(m.PauseTotalNs-s.pauseNs)*per/1e3, "gc-pause-µs/1M-ops")
}
