package address

import "strings"

// StrKeyEncodedLength is the exact encoded length, in characters, of each
// strkey kind:
//
//   - G and C: version byte + 32-byte key + 2-byte CRC16 = 35 bytes = 56 chars
//   - M: version byte + 32-byte key + 8-byte ID + 2-byte CRC16 = 43 bytes = 69 chars
var StrKeyEncodedLength = map[AddressKind]int{
	KindG: 56,
	KindM: 69,
	KindC: 56,
}

// DecodeOptions controls DecodeStrKeyStrict.
type DecodeOptions struct {
	// AllowLowercase accepts lowercase or mixed-case input and normalizes it
	// to uppercase. Off by default: StrKeys are uppercase and lowercase input
	// is rejected with INVALID_BASE32.
	AllowLowercase bool
}

// StrictResult is the successful result of DecodeStrKeyStrict.
type StrictResult struct {
	Kind AddressKind
	// Address is the canonical (uppercase) address.
	Address string
	// Normalized reports that lowercase input was uppercased, which only
	// happens with DecodeOptions.AllowLowercase.
	Normalized bool
	// Payload is the decoded payload without version byte or checksum.
	Payload []byte
}

// DecodeStrKeyStrict decodes a G, M or C strkey and never panics.
//
// Checks run in a fixed order shared with core-ts and core-dart, so every
// implementation reports the same code for the same input:
//
//  1. empty input                          -> INVALID_LENGTH
//  2. first character not G/M/C/g/m/c      -> UNKNOWN_PREFIX
//  3. any ASCII lowercase letter, unless opts.AllowLowercase is set
//     -> INVALID_BASE32
//  4. byte outside A-Z, a-z, 2-7           -> INVALID_BASE32
//     (checked before uppercasing, so non-ASCII letters such as U+017F,
//     which strings.ToUpper folds to "S", can never become valid; it also
//     keeps byte-length and character-length languages in agreement)
//  5. length differs from the kind's size  -> INVALID_LENGTH
//     (truncated or over-long input is rejected before any slicing)
//  6. non-zero trailing bits               -> INVALID_BASE32
//  7. CRC16 mismatch                       -> INVALID_CHECKSUM
//
// Errors are RoutingError values. See spec/vectors/truncated-addresses.json
// and spec/vectors/case-sensitivity.json.
func DecodeStrKeyStrict(input string, opts DecodeOptions) (StrictResult, error) {
	fail := func(code ErrorCode, msg string) (StrictResult, error) {
		return StrictResult{}, RoutingError{Code: code, Input: input, Message: msg}
	}

	if len(input) == 0 {
		return fail(ErrInvalidLength, "address is empty")
	}

	prefix := input[0]
	if 'a' <= prefix && prefix <= 'z' {
		prefix -= 'a' - 'A'
	}
	kind := AddressKind(prefix)
	want, known := StrKeyEncodedLength[kind]
	if !known {
		return fail(ErrUnknownPrefix, "unknown address prefix")
	}

	hasLowercase := strings.ContainsAny(input, "abcdefghijklmnopqrstuvwxyz")
	if hasLowercase && !opts.AllowLowercase {
		return fail(ErrInvalidBase32, "lowercase strkey is not canonical")
	}
	for i := 0; i < len(input); i++ {
		c := input[i]
		if !('A' <= c && c <= 'Z' || 'a' <= c && c <= 'z' || '2' <= c && c <= '7') {
			return fail(ErrInvalidBase32, "invalid base32 character")
		}
	}
	canonical := input
	if hasLowercase {
		// ASCII-only after the loop above, so ToUpper cannot fold anything
		// outside a-z.
		canonical = strings.ToUpper(input)
	}

	if len(canonical) != want {
		return fail(ErrInvalidLength, "invalid address length")
	}

	versionByte, payload, _, err := decodeStrKey(canonical)
	if err != nil {
		switch {
		case err == errInvalidChecksum:
			return fail(ErrInvalidChecksum, "invalid checksum")
		case err == errInvalidBase32:
			return fail(ErrInvalidBase32, "invalid base32 encoding")
		case err == errInvalidLength:
			return fail(ErrInvalidLength, "invalid address length")
		default:
			return fail(ErrUnknownPrefix, "unknown address prefix")
		}
	}
	if k, kerr := kindForVersionByte(versionByte); kerr != nil || k != kind {
		return fail(ErrUnknownPrefix, "version byte does not match prefix")
	}

	return StrictResult{Kind: kind, Address: canonical, Normalized: hasLowercase, Payload: payload}, nil
}
