package corego

import (
	"sync"

	"github.com/REDISHFISH/BLUEWHALE/packages/core-go/address"
)

// DecodeBufferSize is the size of the pooled decoding buffers. It covers the
// largest raw strkey this module decodes (an M-address: version byte, 32-byte
// key, 8-byte ID and 2-byte checksum = 43 bytes) with room to spare.
const DecodeBufferSize = 64

// decodeBufPool recycles fixed-size decoding buffers so high-frequency
// exchange loops do not allocate a fresh buffer per transaction. It holds
// pointers to arrays: storing a slice would allocate to box the slice header
// on every Put.
var decodeBufPool = sync.Pool{
	New: func() any { return new([DecodeBufferSize]byte) },
}

// GetDecodeBuffer returns a zeroed 64-byte buffer from the shared pool.
// Return it with PutDecodeBuffer once nothing references its contents.
func GetDecodeBuffer() *[DecodeBufferSize]byte {
	return decodeBufPool.Get().(*[DecodeBufferSize]byte)
}

// PutDecodeBuffer zeroes buf and returns it to the pool, so a recycled buffer
// never carries a previous caller's key material or IDs. A nil buf is
// ignored. The caller must not use buf, or any slice of it, afterwards.
func PutDecodeBuffer(buf *[DecodeBufferSize]byte) {
	if buf == nil {
		return
	}
	clear(buf[:])
	decodeBufPool.Put(buf)
}

// DecodeStrKeyPooled decodes address into a pooled buffer and calls fn with
// the version byte and payload. The payload aliases the pooled buffer and is
// only valid for the duration of fn: copy anything that must outlive the
// call. The buffer is zeroed and returned to the pool before
// DecodeStrKeyPooled returns, whether or not fn fails.
//
// Decoding follows address.DecodeStrKeyInto, so a well-formed address is
// decoded with zero heap allocations. Its error, or fn's, is returned.
func DecodeStrKeyPooled(addr string, fn func(versionByte byte, payload []byte) error) error {
	buf := GetDecodeBuffer()
	defer PutDecodeBuffer(buf)

	versionByte, payload, err := address.DecodeStrKeyInto(buf[:], addr)
	if err != nil {
		return err
	}
	return fn(versionByte, payload)
}
