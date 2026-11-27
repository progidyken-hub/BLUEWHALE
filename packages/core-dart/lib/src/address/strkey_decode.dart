import 'dart:typed_data';

import 'codes.dart';
import '../util/strkey.dart';

/// Exact encoded length, in characters, of each strkey kind.
///
/// G and C: version byte + 32-byte key + 2-byte CRC16 = 35 bytes = 56 chars.
/// M: version byte + 32-byte key + 8-byte ID + 2-byte CRC16 = 43 bytes =
/// 69 chars.
const Map<AddressKind, int> strKeyEncodedLength = {
  AddressKind.g: 56,
  AddressKind.m: 69,
  AddressKind.c: 56,
};

const Map<String, AddressKind> _kindByPrefix = {
  'G': AddressKind.g,
  'M': AddressKind.m,
  'C': AddressKind.c,
  'g': AddressKind.g,
  'm': AddressKind.m,
  'c': AddressKind.c,
};

const Map<AddressKind, int> _versionByte = {
  AddressKind.g: 6 << 3,
  AddressKind.m: 12 << 3,
  AddressKind.c: 2 << 3,
};

final RegExp _lowercase = RegExp('[a-z]');

/// Base32 alphabet plus ASCII lowercase; nothing else may ever be uppercased.
final RegExp _asciiStrKeyChars = RegExp(r'^[A-Za-z2-7]*$');

/// Result of [decodeStrKey]. Exactly one of [kind] or [error] is non-null.
class StrKeyDecodeResult {
  /// The decoded address kind, or `null` on failure.
  final AddressKind? kind;

  /// The canonical (uppercase) address, or `null` on failure.
  final String? address;

  /// Whether lowercase input was uppercased, which only happens with
  /// `allowLowercase: true`. `false` on failure.
  final bool normalized;

  /// The payload without version byte or checksum, or `null` on failure.
  final Uint8List? payload;

  /// An [ErrorCode] value on failure, otherwise `null`.
  final String? error;

  const StrKeyDecodeResult._({
    this.kind,
    this.address,
    this.normalized = false,
    this.payload,
    this.error,
  });

  /// Whether decoding succeeded.
  bool get ok => error == null;

  @override
  String toString() => ok
      ? 'StrKeyDecodeResult(kind: $kind, address: $address, '
          'normalized: $normalized)'
      : 'StrKeyDecodeResult(error: $error)';
}

StrKeyDecodeResult _fail(String code) => StrKeyDecodeResult._(error: code);

/// Strictly decodes a G, M or C strkey. Never throws.
///
/// StrKeys are uppercase: any ASCII lowercase letter is rejected with
/// `INVALID_BASE32` unless [allowLowercase] is `true`, in which case the input
/// is uppercased and [StrKeyDecodeResult.normalized] is set.
///
/// Checks run in a fixed order shared with core-ts and core-go, so every
/// implementation reports the same [ErrorCode] for the same input:
///
/// 1. empty input                          -> `INVALID_LENGTH`
/// 2. first character not G/M/C/g/m/c      -> `UNKNOWN_PREFIX`
/// 3. any ASCII lowercase letter, unless [allowLowercase] is set
///                                         -> `INVALID_BASE32`
/// 4. character outside A-Z, a-z, 2-7      -> `INVALID_BASE32`
///    (checked before uppercasing, so non-ASCII letters such as U+017F,
///    which `toUpperCase()` folds to "S", can never become valid)
/// 5. length differs from the kind's size  -> `INVALID_LENGTH`
///    (truncated or over-long input is rejected before any slicing)
/// 6. non-zero trailing bits               -> `INVALID_BASE32`
/// 7. CRC16 mismatch                       -> `INVALID_CHECKSUM`
///
/// See spec/vectors/truncated-addresses.json and
/// spec/vectors/case-sensitivity.json.
StrKeyDecodeResult decodeStrKey(String input, {bool allowLowercase = false}) {
  if (input.isEmpty) return _fail(ErrorCode.invalidLength);

  final kind = _kindByPrefix[input[0]];
  if (kind == null) return _fail(ErrorCode.unknownPrefix);

  final hasLowercase = _lowercase.hasMatch(input);
  if (hasLowercase && !allowLowercase) return _fail(ErrorCode.invalidBase32);
  if (!_asciiStrKeyChars.hasMatch(input)) {
    return _fail(ErrorCode.invalidBase32);
  }

  // ASCII-only at this point, so toUpperCase cannot fold anything but a-z.
  final address = hasLowercase ? input.toUpperCase() : input;
  if (address.length != strKeyEncodedLength[kind]) {
    return _fail(ErrorCode.invalidLength);
  }

  final Uint8List bytes;
  try {
    bytes = StrKeyUtil.decodeBase32(address);
  } on FormatException {
    return _fail(ErrorCode.invalidBase32);
  }

  if (bytes[0] != _versionByte[kind]) return _fail(ErrorCode.unknownPrefix);

  final n = bytes.length;
  final crc =
      StrKeyUtil.calculateChecksum(Uint8List.sublistView(bytes, 0, n - 2));
  if (bytes[n - 2] != (crc & 0xFF) || bytes[n - 1] != (crc >> 8)) {
    return _fail(ErrorCode.invalidChecksum);
  }

  return StrKeyDecodeResult._(
    kind: kind,
    address: address,
    normalized: hasLowercase,
    payload: Uint8List.fromList(bytes.sublist(1, n - 2)),
  );
}
