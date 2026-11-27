// Package strkey holds the low-level codec primitives behind Stellar strkeys.
package strkey

import "errors"

// Alphabet is the RFC 4648 base32 alphabet used by every strkey.
const Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

// invalid marks bytes outside the alphabet in decodeMap. Every valid value is
// below 32, so OR-ing the values of a block and testing the top three bits
// detects any invalid byte in the block with a single branch.
const invalid = 0xff

var (
	// ErrInvalidCharacter reports a byte outside the base32 alphabet.
	ErrInvalidCharacter = errors.New("strkey: invalid base32 character")
	// ErrInvalidLength reports an unpadded length that no byte string
	// encodes to (1, 3 or 6 modulo 8).
	ErrInvalidLength = errors.New("strkey: invalid base32 length")
	// ErrNonZeroPadding reports set bits in the unused tail of the last
	// character; such input would not survive a re-encode.
	ErrNonZeroPadding = errors.New("strkey: non-zero base32 trailing bits")
	// ErrShortBuffer reports a dst smaller than DecodedLen(len(src)).
	ErrShortBuffer = errors.New("strkey: destination buffer too short")
)

// decodeMap maps an input byte to its 5-bit value. Lowercase letters decode
// like their uppercase forms, so callers need no uppercased copy.
var decodeMap = func() (m [256]byte) {
	for i := range m {
		m[i] = invalid
	}
	for i := 0; i < len(Alphabet); i++ {
		c := Alphabet[i]
		m[c] = byte(i)
		if c >= 'A' && c <= 'Z' {
			m[c+('a'-'A')] = byte(i)
		}
	}
	return m
}()

// DecodedLen returns the number of bytes that n unpadded base32 characters
// decode to.
func DecodedLen(n int) int {
	return n * 5 / 8
}

// Decode decodes unpadded, case-insensitive base32 from src into dst and
// returns the number of bytes written. It never allocates.
//
// Full 8-character blocks are decoded by an unrolled 8-to-5 conversion with a
// single validity branch per block; only the final partial block (0, 2, 4, 5
// or 7 characters) takes a per-length path. It rejects characters outside the
// alphabet, impossible lengths and non-zero trailing bits, which makes it
// strictly canonical: every accepted input re-encodes to itself (modulo case).
func Decode(dst []byte, src string) (int, error) {
	tail := len(src) % 8
	if tail == 1 || tail == 3 || tail == 6 {
		return 0, ErrInvalidLength
	}
	if len(dst) < DecodedLen(len(src)) {
		return 0, ErrShortBuffer
	}

	n := 0
	full := len(src) - tail
	for i := 0; i < full; i += 8 {
		// Re-slicing to exactly 8 lets the compiler drop the bounds checks
		// on s and the 5-byte store into d.
		s := src[i : i+8]
		d := dst[n : n+5]

		v0 := decodeMap[s[0]]
		v1 := decodeMap[s[1]]
		v2 := decodeMap[s[2]]
		v3 := decodeMap[s[3]]
		v4 := decodeMap[s[4]]
		v5 := decodeMap[s[5]]
		v6 := decodeMap[s[6]]
		v7 := decodeMap[s[7]]
		if (v0|v1|v2|v3|v4|v5|v6|v7)&0xe0 != 0 {
			return 0, ErrInvalidCharacter
		}

		d[0] = v0<<3 | v1>>2
		d[1] = v1<<6 | v2<<1 | v3>>4
		d[2] = v3<<4 | v4>>1
		d[3] = v4<<7 | v5<<2 | v6>>3
		d[4] = v6<<5 | v7
		n += 5
	}

	if tail == 0 {
		return n, nil
	}

	// Partial block: decode the 2, 4, 5 or 7 remaining characters into an
	// 8-value scratch block (missing values are zero) and emit only the
	// bytes they fully cover. The spare low bits of the last character must
	// be zero.
	var v [8]byte
	var acc byte
	for j := 0; j < tail; j++ {
		v[j] = decodeMap[src[full+j]]
		acc |= v[j]
	}
	if acc&0xe0 != 0 {
		return 0, ErrInvalidCharacter
	}

	var spare byte
	switch tail {
	case 2: // 10 bits -> 1 byte, 2 spare
		spare = v[1] & 0x03
	case 4: // 20 bits -> 2 bytes, 4 spare
		spare = v[3] & 0x0f
	case 5: // 25 bits -> 3 bytes, 1 spare
		spare = v[4] & 0x01
	case 7: // 35 bits -> 4 bytes, 3 spare
		spare = v[6] & 0x07
	}
	if spare != 0 {
		return 0, ErrNonZeroPadding
	}

	d := dst[n:]
	switch tail {
	case 7:
		d[3] = v[4]<<7 | v[5]<<2 | v[6]>>3
		fallthrough
	case 5:
		d[2] = v[3]<<4 | v[4]>>1
		fallthrough
	case 4:
		d[1] = v[1]<<6 | v[2]<<1 | v[3]>>4
		fallthrough
	case 2:
		d[0] = v[0]<<3 | v[1]>>2
	}
	return n + DecodedLen(tail), nil
}
