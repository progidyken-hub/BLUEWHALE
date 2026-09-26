package address

import "testing"

// Error code taxonomy parity: the same literals are asserted in core-ts
// (src/test/error-code-parity.test.ts) and core-dart
// (test/error_code_parity_test.dart), and match spec/schema.json.
func TestErrorCodeLiterals(t *testing.T) {
	want := map[ErrorCode]string{
		ErrInvalidChecksum:               "INVALID_CHECKSUM",
		ErrInvalidLength:                 "INVALID_LENGTH",
		ErrInvalidBase32:                 "INVALID_BASE32",
		ErrUnknownPrefix:                 "UNKNOWN_PREFIX",
		ErrRejectedSeedKey:               "REJECTED_SEED_KEY",
		ErrRejectedPreauth:               "REJECTED_PREAUTH",
		ErrRejectedHashX:                 "REJECTED_HASH_X",
		ErrFederationAddressNotSupported: "FEDERATION_ADDRESS_NOT_SUPPORTED",
	}
	for code, literal := range want {
		if string(code) != literal {
			t.Errorf("error code %q, want %q", code, literal)
		}
	}
}
