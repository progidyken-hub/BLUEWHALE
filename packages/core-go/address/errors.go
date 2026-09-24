package address

// ErrorCode represents specific error types for pattern matching.
//
// The string values are part of the cross-SDK contract and must stay
// identical to TypeScript AddressParseErrorCode, Dart AddressErrorCode, and
// the errorCode definition in spec/schema.json.
type ErrorCode string

const (
	ErrUnknownPrefix                 ErrorCode = "UNKNOWN_PREFIX"
	ErrInvalidChecksum               ErrorCode = "INVALID_CHECKSUM"
	ErrInvalidLength                 ErrorCode = "INVALID_LENGTH"
	ErrInvalidBase32                 ErrorCode = "INVALID_BASE32"
	ErrRejectedSeedKey               ErrorCode = "REJECTED_SEED_KEY"
	ErrRejectedPreauth               ErrorCode = "REJECTED_PREAUTH"
	ErrRejectedHashX                 ErrorCode = "REJECTED_HASH_X"
	ErrFederationAddressNotSupported ErrorCode = "FEDERATION_ADDRESS_NOT_SUPPORTED"
)

// AllErrorCodes lists every canonical ErrorCode in spec order.
var AllErrorCodes = []ErrorCode{
	ErrUnknownPrefix,
	ErrInvalidChecksum,
	ErrInvalidLength,
	ErrInvalidBase32,
	ErrRejectedSeedKey,
	ErrRejectedPreauth,
	ErrRejectedHashX,
	ErrFederationAddressNotSupported,
}

// IsValid reports whether c is one of the canonical error codes.
func (c ErrorCode) IsValid() bool {
	for _, known := range AllErrorCodes {
		if c == known {
			return true
		}
	}
	return false
}

// RoutingError is the main custom error type
type RoutingError struct {
	Code    ErrorCode
	Input   string
	Message string
}

func (e RoutingError) Error() string {
	return e.Message
}

// Is allows errors.Is to match by Code
func (e RoutingError) Is(target error) bool {
	if targetErr, ok := target.(RoutingError); ok {
		return e.Code == targetErr.Code
	}
	return false
}

// Common error variables
var (
	ErrInvalidChecksumError               = RoutingError{Code: ErrInvalidChecksum, Message: "invalid checksum"}
	ErrInvalidBase32Error                 = RoutingError{Code: ErrInvalidBase32, Message: "invalid base32 encoding"}
	ErrInvalidLengthError                 = RoutingError{Code: ErrInvalidLength, Message: "invalid address length"}
	ErrUnknownPrefixError                 = RoutingError{Code: ErrUnknownPrefix, Message: "unknown address prefix"}
	ErrFederationAddressNotSupportedError = RoutingError{Code: ErrFederationAddressNotSupported, Message: "federation address not supported"}
)

// Legacy / additional error for version byte
var ErrUnknownVersionByteError = RoutingError{
	Code:    ErrUnknownPrefix,
	Message: "unknown version byte",
}
