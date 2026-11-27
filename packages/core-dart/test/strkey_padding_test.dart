// Base32 padding vectors for the table-driven decoder (#378).
//
// Every byte length from 0 to 40 is round-tripped, which covers all five
// partial-group residues (bits mod 40). Non-canonical trailing bits must still
// be rejected after the lookup-table change.
import 'dart:typed_data';

import 'package:bluewhale_core/src/util/strkey.dart';
import 'package:test/test.dart';

Uint8List _payload(int length) =>
    Uint8List.fromList(List<int>.generate(length, (i) => (i * 37 + 11) & 0xFF));

void main() {
  group('decodeBase32 padding vectors', () {
    for (var length = 0; length <= 40; length++) {
      test('round-trips a $length-byte payload', () {
        final bytes = _payload(length);
        final encoded = StrKeyUtil.encodeBase32(bytes);
        expect(StrKeyUtil.decodeBase32(encoded), bytes);
      });
    }

    test('accepts lowercase input and decodes to the same bytes', () {
      final bytes = _payload(35);
      final encoded = StrKeyUtil.encodeBase32(bytes);
      expect(StrKeyUtil.decodeBase32(encoded.toLowerCase()), bytes);
    });

    test('rejects non-zero unused trailing bits in the final group', () {
      // 0x00 encodes to "AA"; "AB" sets a bit beyond the 8-bit payload.
      expect(
        () => StrKeyUtil.decodeBase32('AB'),
        throwsA(isA<FormatException>()),
      );
    });

    test('names a character outside the alphabet by index', () {
      expect(
        () => StrKeyUtil.decodeBase32('AA1A'),
        throwsA(
          isA<FormatException>().having((e) => e.offset, 'offset', 2),
        ),
      );
    });
  });
}
