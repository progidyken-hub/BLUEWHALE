// Shared vectors: spec/vectors/truncated-addresses.json.
//
// Strings that keep the M strkey prefix but lack part of the 40-byte payload
// must be rejected with INVALID_LENGTH and never surface a RangeError,
// FormatException or any other unexpected error.
import 'dart:convert';
import 'dart:io';

// Imports the implementation files directly so this suite does not depend
// on unrelated parts of the public library compiling.
import 'package:bluewhale_core/src/address/codes.dart';
import 'package:bluewhale_core/src/address/detect.dart';
import 'package:bluewhale_core/src/address/strkey_decode.dart';
import 'package:bluewhale_core/src/exceptions.dart';
import 'package:bluewhale_core/src/muxed/muxed_address.dart';
import 'package:test/test.dart';

void main() {
  final doc = jsonDecode(
    File('../../spec/vectors/truncated-addresses.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  final cases = (doc['cases'] as List).cast<Map<String, dynamic>>();
  String addressOf(Map<String, dynamic> c) =>
      (c['input'] as Map<String, dynamic>)['address'] as String;
  Map<String, dynamic> expectedOf(Map<String, dynamic> c) =>
      c['expected'] as Map<String, dynamic>;

  test('covers every M-address truncation from 10 to 68 characters', () {
    final lengths = cases
        .where((c) => expectedOf(c)['error'] == ErrorCode.invalidLength)
        .map((c) => addressOf(c).length)
        .where((n) => n < 69)
        .toList();
    expect(lengths, List.generate(59, (i) => i + 10));
  });

  group('spec/vectors/truncated-addresses.json', () {
    for (final c in cases) {
      final address = addressOf(c);
      final expected = expectedOf(c);

      test(c['description'] as String, () {
        final result = decodeStrKey(address);
        if (expected['ok'] == true) {
          expect(result.ok, isTrue);
          expect(result.kind!.name.toUpperCase(), expected['kind']);
          expect(result.address, expected['address']);
          return;
        }

        expect(result.ok, isFalse);
        expect(result.error, expected['error']);

        // The muxed decoder must reject the same input with its own
        // structured exception, not a RangeError or FormatException.
        expect(
          () => MuxedAddress.decode(address),
          throwsA(isA<StellarAddressException>()),
        );
        expect(detect(address), isNull);
      });
    }
  });
}
