/// Canonical address-parse error codes returned in
/// `ParseResult.error.code` and `RoutingResult.destinationError.code`.
///
/// The [code] string values are part of the cross-SDK contract and must stay
/// identical to TypeScript `AddressParseErrorCode`, Go `address.ErrorCode`,
/// and the `errorCode` definition in `spec/schema.json`. The string constants
/// in `ErrorCode` (address/codes.dart) mirror these values.
enum AddressErrorCode {
  /// The address prefix is not one of 'G', 'M', or 'C'.
  unknownPrefix('UNKNOWN_PREFIX'),

  /// The CRC-16 checksum of the address is invalid.
  invalidChecksum('INVALID_CHECKSUM'),

  /// The decoded length of the address does not match its prefix requirements.
  invalidLength('INVALID_LENGTH'),

  /// The input string is not a valid Base32 encoded sequence.
  invalidBase32('INVALID_BASE32'),

  /// Seed keys (starting with 'S') are not accepted as payment destinations.
  rejectedSeedKey('REJECTED_SEED_KEY'),

  /// Pre-authorized transaction hashes (starting with 'T') are not accepted.
  rejectedPreauth('REJECTED_PREAUTH'),

  /// HashX identifiers (starting with 'X') are not accepted.
  rejectedHashX('REJECTED_HASH_X'),

  /// Federation addresses (name*domain.com) are not supported by this kit.
  federationAddressNotSupported('FEDERATION_ADDRESS_NOT_SUPPORTED');

  const AddressErrorCode(this.code);

  /// The wire-format string literal shared by every SDK.
  final String code;

  /// Returns the [AddressErrorCode] whose [code] equals [value], or null if
  /// [value] is not a canonical error code.
  static AddressErrorCode? tryParse(String? value) {
    for (final c in values) {
      if (c.code == value) return c;
    }
    return null;
  }

  @override
  String toString() => code;
}

class StellarAddressException implements Exception {
  final String message;
  const StellarAddressException(this.message);

  @override
  String toString() => 'StellarAddressException: $message';
}
