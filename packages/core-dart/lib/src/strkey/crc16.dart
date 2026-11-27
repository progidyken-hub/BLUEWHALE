import 'dart:typed_data';

/// CRC16-XModem implementation used for strkey checksum validation.
///
/// Polynomial: 0x1021, initial value: 0x0000, no reflection, no final XOR.
class Crc16 {
  static const int _polynomial = 0x1021;
  static const int _initialValue = 0x0000;

  /// Computes the CRC16-XModem checksum of [bytes].
  static int compute(List<int> bytes) {
    var crc = _initialValue;
    for (final byte in bytes) {
      crc ^= (byte & 0xFF) << 8;
      for (var i = 0; i < 8; i++) {
        if ((crc & 0x8000) != 0) {
          crc = ((crc << 1) ^ _polynomial) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc & 0xFFFF;
  }
}

/// Compares two byte buffers in constant time with respect to their contents.
///
/// Returns `true` only when [a] and [b] have the same length and identical
/// bytes. The comparison never returns early on a mismatched byte index, so
/// the execution time does not leak information about where (or whether) the
/// buffers differ. This mitigates timing side-channel attacks during strkey
/// checksum verification.
bool constantTimeCompare(Uint8List a, Uint8List b) {
  // Length is not secret; a length mismatch is reported immediately.
  if (a.length != b.length) {
    return false;
  }

  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff == 0;
}
