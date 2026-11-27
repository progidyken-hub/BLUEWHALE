package address

import "github.com/REDISHFISH/BLUEWHALE/packages/core-go/strkey"

// strkeyAlphabet is the RFC 4648 base32 alphabet used by every strkey.
const strkeyAlphabet = strkey.Alphabet

// DecodedStrKeyLen returns the number of raw bytes (version byte, payload and
// checksum) that a strkey of encodedLen characters decodes to.
func DecodedStrKeyLen(encodedLen int) int {
	return strkey.DecodedLen(encodedLen)
}

// DecodeStrKeyInto is DecodeStrKey for callers that supply the decoding
// buffer. It decodes address into dst and returns the version byte and the
// payload, which aliases dst. It does not allocate, so a caller that reuses
// dst (for example from a sync.Pool) decodes with zero heap allocations.
//
// dst must hold at least DecodedStrKeyLen(len(address)) bytes; a shorter dst
// is reported as an invalid length. Like DecodeStrKey it is case-insensitive
// and rejects unknown prefixes, non-alphabet characters, impossible lengths,
// non-zero trailing bits, unknown version bytes and checksum mismatches, with
// the same errors.
//
// The one difference is that only ASCII input is accepted: DecodeStrKey
// uppercases with strings.ToUpper, which also folds a few non-ASCII runes
// (such as U+017F, "ſ") into ASCII letters. Callers that must reproduce that
// exactly can fall back to DecodeStrKey when this function returns an error.
func DecodeStrKeyInto(dst []byte, address string) (versionByte byte, payload []byte, err error) {
	if len(address) < 3 {
		return 0, nil, errInvalidLength
	}

	switch address[0] {
	case 'G', 'g', 'M', 'm', 'C', 'c':
	default:
		return 0, nil, errUnknownPrefix
	}

	if len(dst) < DecodedStrKeyLen(len(address)) {
		return 0, nil, errInvalidLength
	}

	// strkey.Decode converts 8 characters to 5 bytes per unrolled step. It
	// rejects non-alphabet bytes, lengths of 1, 3 or 6 modulo 8 (which no
	// byte string encodes to) and set spare bits (which would not survive a
	// re-encode); encoding/base32 and the round-trip check in DecodeStrKey
	// reject the same inputs. dst is long enough, so every error is a
	// base32 error.
	n, err := strkey.Decode(dst, address)
	if err != nil {
		return 0, nil, errInvalidBase32
	}

	// Minimum length: version byte (1) + payload (at least 1) + checksum (2).
	if n < 4 {
		return 0, nil, errInvalidLength
	}

	versionByte = dst[0]
	switch versionByte {
	case VersionByteG, VersionByteM, VersionByteC:
	default:
		return 0, nil, errUnknownVersionByte
	}

	crc := CalculateCRC16(dst[:n-2])
	if dst[n-2] != byte(crc) || dst[n-1] != byte(crc>>8) {
		return 0, nil, errInvalidChecksum
	}

	return versionByte, dst[1 : n-2], nil
}
