package strkey

import (
	"fmt"
)

// Contract represents a Soroban contract address (C-address).
type Contract struct {
	address [32]byte
}

// NewContract creates a new Contract from a 32-byte payload.
func NewContract(address [32]byte) Contract {
	return Contract{address: address}
}

// Address returns the raw 32-byte contract address payload.
func (c Contract) Address() [32]byte {
	return c.address
}

// EncodeContract encodes a 32-byte contract address payload into its
// C-address strkey representation.
func EncodeContract(address [32]byte) (string, error) {
	return encode(VersionByteContract, address[:])
}

// DecodeContract decodes a C-address strkey into its 32-byte contract
// address payload, validating the version byte, length, and checksum.
func DecodeContract(address string) (Contract, error) {
	raw, err := decode(VersionByteContract, address)
	if err != nil {
		return Contract{}, err
	}

	if len(raw) != 32 {
		return Contract{}, fmt.Errorf("invalid contract address length: %d", len(raw))
	}

	var payload [32]byte
	copy(payload[:], raw)

	return NewContract(payload), nil
}
