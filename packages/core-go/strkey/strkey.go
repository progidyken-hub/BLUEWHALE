package strkey

import (
	"fmt"

	"github.com/stellar/go/support/errors"
)

// VersionByte represents one of the possible prefix values for a StrKey
// payload.
type VersionByte byte

const (
	// VersionByteAccountID is the version byte used for encoded stellar addresses
	VersionByteAccountID VersionByte = 6 << 3 // Base32-encodes to 'G...'

	// VersionByteSeed is the version byte used for encoded stellar seed
	VersionByteSeed VersionByte = 18 << 3 // Base32-encodes to 'S...'

	// VersionByteMuxedAccount is the version byte used for encoded stellar multiplexed addresses
	VersionByteMuxedAccount VersionByte = 12 << 3 // Base32-encodes to 'M...'

	// VersionByteHashX is the version byte used for encoded stellar hashX
	// signer keys.
	VersionByteHashX VersionByte = 23 << 3 // Base32-encodes to 'X...'

	// VersionByteSignedPayload is the version byte used for encoded stellar
	// signed payloads.
	VersionByteSignedPayload VersionByte = 15 << 3 // Base32-encodes to 'P...'

	// VersionByteContract is the version byte used for encoded stellar
	// contract addresses.
	VersionByteContract VersionByte = 2 << 3 // Base32-encodes to 'C...'
)

// VersionByteContract is 0x18 (2 << 3).

// DecodedPayload is the result of decoding a StrKey.
type DecodedPayload struct {
	VersionByte VersionByte
	Payload     []byte
}

// IsValidVersionByte returns true when the provided version byte is valid.
func IsValidVersionByte(b VersionByte) bool {
	switch b {
	case VersionByteAccountID, VersionByteSeed, VersionByteMuxedAccount, VersionByteHashX, VersionByteSignedPayload, VersionByteContract:
		return true
	default:
		return false
	}
}

// Encode encodes the provided payload using the provided version byte.
func Encode(version VersionByte, payload []byte) (string, error) {
	if !IsValidVersionByte(version) {
		return "", errors.New("invalid version byte")
	}

	return encode(version, payload)
}

// Decode decodes the provided StrKey into its version byte and payload.
func Decode(address string) (VersionByte, []byte, error) {
	decoded, err := decode(address)
	if err != nil {
		return 0, nil, err
	}

	if !IsValidVersionByte(decoded.VersionByte) {
		return 0, nil, fmt.Errorf("invalid version byte: %d", decoded.VersionByte)
	}

	return decoded.VersionByte, decoded.Payload, nil
}
