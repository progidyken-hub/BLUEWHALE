// Runs every case in spec/regex.json through Dart's RegExp engine.
//
// The same cases are asserted in core-ts (src/test/regex-spec.test.ts),
// core-go (address/regex_spec_test.go) and, for ECMAScript and PCRE/Perl, in
// scripts/check-regex-spec.js.
import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';

void main() {
  final spec = jsonDecode(File('../../spec/regex.json').readAsStringSync())
      as Map<String, dynamic>;
  final patterns = (spec['patterns'] as Map<String, dynamic>).map(
    (name, def) => MapEntry(
      name,
      RegExp((def as Map<String, dynamic>)['pattern'] as String),
    ),
  );

  group('spec/regex.json parity (Dart RegExp)', () {
    for (final raw in spec['cases'] as List<dynamic>) {
      final c = raw as Map<String, dynamic>;
      final name = c['pattern'] as String;
      test('[$name] ${c['description']}', () {
        final re = patterns[name];
        expect(re, isNotNull, reason: 'unknown pattern $name');
        expect(re!.hasMatch(c['input'] as String), c['match'] as bool);
      });
    }
  });
}
