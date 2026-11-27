package strkey

import (
	"encoding/binary"
	"errors"
	"fmt"
)

// MuxedAccount represents a muxed account (M-address) as defined by SEP-23.
// It wraps a base G-address with a 64-bit subaccount ID.
type MuxedAccount struct {
	AccountID   string
	SubaccountID uint64
}

// EncodeMuxedAccount encodes a muxed account into its M-address string form.
func EncodeMuxedAccount(accountID string, subaccountID uint64) (string, error) {
	raw, err := Decode(AccountID, accountID)
	if err != nil {
		return "", fmt.Errorf("invalid account id: %w", err)
	}

	payload := make([]byte, 0, len(raw)+8)
	payload = append(payload, raw...)

	// Subaccount IDs are encoded as 64-bit big-endian unsigned integers.
	var idBytes [8]byte
	binary.BigEndian.PutUint64(idBytes[:], subaccountID)
	payload = append(payload, idBytes[:]...)

	return Encode(MuxedAccountID, payload)
}

// DecodeMuxedAccount decodes an M-address into its base account and subaccount ID.
func DecodeMuxedAccount(muxedAccountID string) (*MuxedAccount, error) {
	raw, err := Decode(MuxedAccountID, muxedAccountID)
	if err != nil {
		return nil, fmt.Errorf("invalid muxed account id: %w", err)
	}

	if len(raw) != 32+8 {
		return nil, errors.New("invalid muxed account payload length")
	}

	accountID, err := Encode(AccountID, raw[:32])
	if err != nil {
		return nil, fmt.Errorf("invalid embedded account id: %w", err)
	}

	// Subaccount IDs are encoded as 64-bit big-endian unsigned integers.
	// Using binary.BigEndian explicitly keeps decoding independent of the
	// host architecture's native byte order.
	subaccountID := binary.BigEndian.Uint64(raw[32:40])

	return &MuxedAccount{
		AccountID:    accountID,
		SubaccountID: subaccountID,
	}, nil
}

// SubaccountIDHigh returns the high 32 bits of the subaccount ID.
// Bitwise extraction is performed on the decoded uint64 value, so results
// are identical on big-endian and little-endian hosts.
func (m *MuxedAccount) SubaccountIDHigh() uint32 {
	return uint32(m.SubaccountID >> 32)
}

// SubaccountIDLow returns the low 32 bits of the subaccount ID.
func (m *MuxedAccount) SubaccountIDLow() uint32 {
	return uint32(m.SubaccountID & 0xFFFFFFFF)
}
