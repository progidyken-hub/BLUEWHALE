// Shared vectors: spec/vectors/case-sensitivity.json.
//
// StrKeys are uppercase. decodeStrKey rejects lowercase input with
// INVALID_BASE32 unless the caller opts in with allowLowercase: true.
import 'dart:convert';
import 'dart:io';

// Imports the implementation files directly so this suite does not depend
// on unrelated parts of the public library compiling.
import 'package:bluewhale_core/src/address/codes.dart';
import 'package:bluewhale_core/src/address/strkey_decode.dart';
import 'package:test/test.dart';

void main() {
  final doc = jsonDecode(
    File('../../spec/vectors/case-sensitivity.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  final cases = (doc['cases'] as List).cast<Map<String, dynamic>>();

  test('covers lowercase g..., m... and c... addresses', () {
    final prefixes = <String>{};
    for (final c in cases) {
      final input = c['input'] as Map<String, dynamic>;
      final expected = c['expected'] as Map<String, dynamic>;
      final address = input['address'] as String;
      if (input['allowLowercase'] == false &&
          expected['ok'] == false &&
          'gmc'.contains(address[0])) {
        prefixes.add(address[0]);
      }
    }
    expect(prefixes, {'g', 'm', 'c'});
  });

  test('rejects lowercase when allowLowercase is omitted', () {
    const g = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';
    expect(decodeStrKey(g.toLowerCase()).error, ErrorCode.invalidBase32);
  });

  group('spec/vectors/case-sensitivity.json', () {
    for (final c in cases) {
      final input = c['input'] as Map<String, dynamic>;
      final expected = c['expected'] as Map<String, dynamic>;

      test(c['description'] as String, () {
        final result = decodeStrKey(
          input['address'] as String,
          allowLowercase: input['allowLowercase'] as bool,
        );
        if (expected['ok'] == true) {
          expect(result.ok, isTrue, reason: 'error: ${result.error}');
          expect(result.kind!.name.toUpperCase(), expected['kind']);
          expect(result.address, expected['address']);
          expect(result.normalized, expected['normalized']);
        } else {
          expect(result.ok, isFalse);
          expect(result.error, expected['error']);
        }
      });
    }
  });
}
