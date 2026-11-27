package corego

import (
	"encoding/base64"
	"errors"
	"fmt"
)

// MemoType represents the type of a Stellar memo.
type MemoType int32

const (
	MemoNone     MemoType = 0
	MemoText     MemoType = 1
	MemoID       MemoType = 2
	MemoHash     MemoType = 3
	MemoReturn   MemoType = 4
)

// MemoHashSize is the fixed size of MEMO_HASH and MEMO_RETURN payloads.
const MemoHashSize = 32

// Memo represents a Stellar memo attached to a transaction.
type Memo struct {
	Type MemoType
	Text string
	ID   uint64
	// Hash holds the fixed-size payload for MEMO_HASH and MEMO_RETURN.
	// Using a value array avoids heap-allocated slices for arbitrary
	// 0..32 byte payloads.
	Hash [MemoHashSize]byte
	// HashLen is the number of valid bytes in Hash (0..32).
	HashLen int
}

// ErrMemoPayloadTooLarge is returned when a MEMO_HASH or MEMO_RETURN
// payload exceeds the fixed 32-byte limit.
var ErrMemoPayloadTooLarge = errors.New("memo payload exceeds 32 bytes")

// NewMemoReturn builds a MEMO_RETURN memo from an arbitrary byte payload.
// Payloads longer than 32 bytes are rejected; shorter payloads are copied
// into the fixed-size array with a bounds check.
func NewMemoReturn(payload []byte) (Memo, error) {
	m := Memo{Type: MemoReturn}
	if err := m.setHashPayload(payload); err != nil {
		return Memo{}, err
	}
	return m, nil
}

// NewMemoHash builds a MEMO_HASH memo from an arbitrary byte payload.
func NewMemoHash(payload []byte) (Memo, error) {
	m := Memo{Type: MemoHash}
	if err := m.setHashPayload(payload); err != nil {
		return Memo{}, err
	}
	return m, nil
}

// setHashPayload copies payload into the fixed-size Hash array after a
// bounds check, recording the valid length.
func (m *Memo) setHashPayload(payload []byte) error {
	if len(payload) > MemoHashSize {
		return fmt.Errorf("%w: got %d", ErrMemoPayloadTooLarge, len(payload))
	}
	m.Hash = [MemoHashSize]byte{}
	m.HashLen = 0
	if len(payload) > 0 {
		// Bounds check before copying into the fixed-size array.
		if len(payload) > len(m.Hash) {
			return fmt.Errorf("%w: got %d", ErrMemoPayloadTooLarge, len(payload))
		}
		copy(m.Hash[:], payload)
		m.HashLen = len(payload)
	}
	return nil
}

// Payload returns the valid bytes of the fixed-size Hash array.
func (m Memo) Payload() []byte {
	if m.HashLen <= 0 {
		return nil
	}
	if m.HashLen > MemoHashSize {
		return nil
	}
	return m.Hash[:m.HashLen]
}

// String renders the memo for display.
func (m Memo) String() string {
	switch m.Type {
	case MemoNone:
		return ""
	case MemoText:
		return m.Text
	case MemoID:
		return fmt.Sprintf("%d", m.ID)
	case MemoHash, MemoReturn:
		return base64.StdEncoding.EncodeToString(m.Payload())
	default:
		return ""
	}
}
