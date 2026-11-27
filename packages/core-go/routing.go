package core

import (
	"encoding/base32"
	"errors"
	"fmt"
	"strings"
)

// ParseDepositDestination parses a SEP-0023 / SEP-0029 style deposit destination
// string of the form "<address>:<memo>" or just "<address>".
func ParseDepositDestination(destination string) (address string, memo string, err error) {
	if destination == "" {
		return "", "", errors.New("empty destination")
	}
	parts := strings.SplitN(destination, ":", 2)
	address = parts[0]
	if len(parts) == 2 {
		memo = parts[1]
	}
	if address == "" {
		return "", "", errors.New("empty address")
	}
	return address, memo, nil
}

// ParseDepositDestinationBytes is the zero-copy counterpart of
// ParseDepositDestination. It operates directly on the caller's byte slice and
// avoids allocating sub-slices for the address and memo by returning them as
// sub-slices of the input buffer. The returned slices alias `destination`, so
// callers must not mutate the buffer while the results are in use.
func ParseDepositDestinationBytes(destination []byte) (address []byte, memo []byte, err error) {
	if len(destination) == 0 {
		return nil, nil, errors.New("empty destination")
	}
	for i := 0; i < len(destination); i++ {
		if destination[i] == ':' {
			address = destination[:i]
			memo = destination[i+1:]
			if len(address) == 0 {
				return nil, nil, errors.New("empty address")
			}
			return address, memo, nil
		}
	}
	address = destination
	if len(address) == 0 {
		return nil, nil, errors.New("empty address")
	}
	return address, nil, nil
}

// base32NoPadding is the SEP-0023 base32 alphabet without padding.
var base32NoPadding = base32.StdEncoding.WithPadding(base32.NoPadding)

// crc16XModem computes the CRC16-XModem checksum used by SEP-0023 strkeys.
func crc16XModem(data []byte) uint16 {
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

// DecodeStrkeyBytes decodes a SEP-0023 strkey directly from a byte slice without
// allocating intermediate sub-slices. It validates the base32 payload and the
// trailing CRC16-XModem checksum in place. The returned payload aliases a
// freshly decoded buffer (base32 decoding cannot be done fully in place), but no
// per-character string allocations occur.
func DecodeStrkeyBytes(strkey []byte) (version byte, payload []byte, err error) {
	if len(strkey) < 3 {
		return 0, nil, fmt.Errorf("strkey too short: %d", len(strkey))
	}

	// Decode base32 in place into a reusable buffer sized to the input.
	decoded := make([]byte, base32NoPadding.DecodedLen(len(strkey)))
	n, err := base32NoPadding.Decode(decoded, strkey)
	if err != nil {
		return 0, nil, fmt.Errorf("invalid base32: %w", err)
	}
	decoded = decoded[:n]

	if len(decoded) < 3 {
		return 0, nil, errors.New("decoded strkey too short")
	}

	payloadLen := len(decoded) - 2
	version = decoded[0]
	payload = decoded[1:payloadLen]

	// Verify CRC16 over version + payload without allocating a new slice.
	var crc uint16
	for _, b := range decoded[:payloadLen] {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}

	checksum := uint16(decoded[payloadLen]) | uint16(decoded[payloadLen+1])<<8
	if crc != checksum {
		return 0, nil, errors.New("invalid strkey checksum")
	}

	return version, payload, nil
}
