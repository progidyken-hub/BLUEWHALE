package bluewhale

import "errors"

// Sentinel errors returned by the Bluewhale core package. They are wrapped
// with %w by the decoding helpers so callers can match them using the
// standard library's errors.Is and errors.As.
var (
	// ErrInvalidAddress indicates that an address could not be decoded or
	// failed validation.
	ErrInvalidAddress = errors.New("bluewhale: invalid address")

	// ErrInvalidChecksum indicates that a checksum verification failed.
	ErrInvalidChecksum = errors.New("bluewhale: invalid checksum")

	// ErrMuxedConflict indicates that a muxed account conflicts with the
	// expected account.
	ErrMuxedConflict = errors.New("bluewhale: muxed account conflict")
)
