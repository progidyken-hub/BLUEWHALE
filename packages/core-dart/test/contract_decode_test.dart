// decodeContract: C-address StrKey to 32-byte contract ID, version 0x10 (#381).
//
// Fixtures are built at runtime from the same StrKey primitives so the test
// does not depend on an external vector it cannot check here.
import 'dart:typed_data';

import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:bluewhale_core/src/util/strkey.dart';
import 'package:test/test.dart';

String _strkey(int version, List<int> body) {
  final payload = Uint8List.fromList(<int>[version, ...body]);
  final crc = StrKeyUtil.calculateChecksum(payload);
  final full = Uint8List.fromList(<int>[...payload, crc & 0xFF, (crc >> 8) & 0xFF]);
  return StrKeyUtil.encodeBase32(full);
}

void main() {
  final contractId = List<int>.generate(32, (i) => (i * 13 + 5) & 0xFF);
  final cAddress = _strkey(0x10, contractId);

  group('decodeContract', () {
    test('starts with C and decodes to the 32-byte contract ID', () {
      expect(cAddress[0], 'C');
      expect(decodeContract(cAddress), Uint8List.fromList(contractId));
    });

    test('accepts lowercase input', () {
      expect(decodeContract(cAddress.toLowerCase()), Uint8List.fromList(contractId));
    });

    test('rejects a G address', () {
      final gAddress = _strkey(0x30, contractId);
      expect(() => decodeContract(gAddress), throwsA(isA<FormatException>()));
    });

    test('rejects an empty string', () {
      expect(() => decodeContract(''), throwsA(isA<FormatException>()));
    });

    test('rejects a wrong length', () {
      final short = _strkey(0x10, contractId.sublist(0, 31));
      expect(() => decodeContract(short), throwsA(isA<FormatException>()));
    });

    test('rejects a checksum mismatch', () {
      final last = cAddress[cAddress.length - 1];
      final tampered = cAddress.substring(0, cAddress.length - 1) + (last == 'A' ? 'B' : 'A');
      expect(() => decodeContract(tampered), throwsA(isA<FormatException>()));
    });
  });
}
