package bluewhale

import (
	"encoding/base32"
	"fmt"
	"strings"
)

// ParseAddress decodes a StrKey-encoded address and validates its checksum.
// Decoding failures are wrapped with the package sentinel errors so callers
// can match them using errors.Is.
func ParseAddress(address string) ([]byte, error) {
	if address == "" {
		return nil, fmt.Errorf("%w: empty address", ErrInvalidAddress)
	}

	decoded, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(address))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidAddress, err)
	}

	if len(decoded) < 3 {
		return nil, fmt.Errorf("%w: decoded address too short", ErrInvalidAddress)
	}

	payload := decoded[:len(decoded)-2]
	checksum := decoded[len(decoded)-2:]

	if !verifyChecksum(payload, checksum) {
		return nil, fmt.Errorf("%w", ErrInvalidChecksum)
	}

	return payload[1:], nil
}

// verifyChecksum validates the trailing checksum bytes against the payload.
func verifyChecksum(payload, checksum []byte) bool {
	computed := crc16(payload)
	return checksum[0] == byte(computed&0xff) && checksum[1] == byte(computed>>8)
}

// crc16 computes the XModem CRC16 used by StrKey checksums.
func crc16(data []byte) uint16 {
	var crc uint16
	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}
