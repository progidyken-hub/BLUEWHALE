// Shared vectors: spec/vectors/subaccount-formatting.json.
//
// uint64 subaccount (muxed) IDs must be formatted as plain decimal strings.
// Dart's reference formatter is BigInt.toString(); int is 64-bit signed on
// the VM and a 53-bit double on the web, so neither may be used for IDs.
import 'dart:convert';
import 'dart:io';

// Imports the implementation file directly so this suite does not depend on
// unrelated parts of the public library compiling.
import 'package:bluewhale_core/src/muxed/muxed_address.dart';
import 'package:test/test.dart';

final _canonicalDecimal = RegExp(r'^(0|[1-9][0-9]*)$');
final _uint64Max = (BigInt.one << 64) - BigInt.one;

void main() {
  final doc = jsonDecode(
    File('../../spec/vectors/subaccount-formatting.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  final cases = (doc['cases'] as List).cast<Map<String, dynamic>>();

  test('includes values at and just below 2^64-1', () {
    final ids = cases
        .map((c) => BigInt.parse(
            (c['expected'] as Map<String, dynamic>)['decimal'] as String))
        .toSet();
    for (var i = 0; i < 3; i++) {
      expect(ids, contains(_uint64Max - BigInt.from(i)));
    }
  });

  group('spec/vectors/subaccount-formatting.json', () {
    for (final c in cases) {
      final input = c['input'] as Map<String, dynamic>;
      final expected = c['expected'] as Map<String, dynamic>;
      final baseG = input['base_g'] as String;
      final decimal = expected['decimal'] as String;
      final mAddress = expected['mAddress'] as String;

      test(c['description'] as String, () {
        final id = BigInt.parse(input['id_hex'] as String, radix: 16);

        final formatted = id.toString();
        expect(formatted, decimal);
        expect(formatted, matches(_canonicalDecimal));
        expect(id <= _uint64Max, isTrue);

        expect(MuxedAddress.encode(baseG: baseG, id: id), mAddress);
        final decoded = MuxedAddress.decode(mAddress);
        expect(decoded.baseG, baseG);
        expect(decoded.id.toString(), decimal);
      });
    }
  });
}
