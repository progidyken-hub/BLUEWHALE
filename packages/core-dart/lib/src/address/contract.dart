import 'dart:typed_data';

import '../util/strkey.dart';

/// Version byte of a `C…` contract StrKey: `2 << 3`, per SEP-23.
const int _contractVersionByte = 0x10;

/// Decoded length of a contract StrKey: version (1) + contract ID (32) + checksum (2).
const int _contractDecodedLength = 35;

/// Decodes a Soroban contract address (`C…`) to its 32-byte contract ID.
///
/// Throws [FormatException] when [address] is not a valid contract StrKey: the
/// prefix is not `C`, the Base32 or checksum is invalid, or the length or
/// version byte is wrong.
Uint8List decodeContract(String address) {
  if (address.isEmpty || address[0].toUpperCase() != 'C') {
    throw FormatException('Not a contract address: must start with C', address);
  }

  final decoded = StrKeyUtil.decodeBase32(address);
  if (decoded.length != _contractDecodedLength) {
    throw FormatException('Invalid contract address length', address);
  }

  final payload = Uint8List.sublistView(decoded, 0, decoded.length - 2);
  final checksum = StrKeyUtil.calculateChecksum(payload);
  if (decoded[decoded.length - 2] != (checksum & 0xFF) ||
      decoded[decoded.length - 1] != ((checksum >> 8) & 0xFF)) {
    throw FormatException('Invalid contract address checksum', address);
  }

  if (payload[0] != _contractVersionByte) {
    throw FormatException('Invalid contract address version byte', address);
  }

  return Uint8List.fromList(payload.sublist(1));
}
