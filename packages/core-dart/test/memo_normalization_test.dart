// Cross-SDK parity tests for MEMO_TEXT routing-ID normalization.
//
// Driven by spec/memo_text_normalization.json, which is shared with core-ts
// (src/routing/memo.test.ts) and core-go (routing/memo_test.go) so all three
// SDKs return byte-identical normalized values and warning payloads.
library;

import 'dart:convert';
import 'dart:io';

import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  const baseG = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';

  final file = File('../../spec/memo_text_normalization.json');
  final fixture = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  final cases =
      (fixture['cases'] as List<dynamic>).cast<Map<String, dynamic>>();

  group('normalizeMemoTextId cross-SDK parity fixture', () {
    test('fixture is not empty', () {
      expect(cases, isNotEmpty);
    });

    for (final c in cases) {
      final input = c['input'] as String;
      final expectedNormalized = c['normalized'] as String?;
      final expectedWarning = c['warning'] as Map<String, dynamic>?;

      test('normalizes ${jsonEncode(input)}', () {
        final result = normalizeMemoTextId(input);

        expect(result.normalized, equals(expectedNormalized));

        if (expectedWarning == null) {
          expect(result.warnings, isEmpty);
          return;
        }

        expect(result.warnings, hasLength(1));
        final w = result.warnings.single;
        expect(w.code, equals(WarningCode.nonCanonicalRoutingId));
        expect(w.severity, equals('warn'));
        expect(w.normalization, isNotNull);
        expect(w.normalization!.original, equals(expectedWarning['original']));
        expect(
            w.normalization!.normalized, equals(expectedWarning['normalized']));
      });
    }
  });

  group('extractRoutingSync MEMO_TEXT normalization', () {
    test("routes '00123' as 123 and keeps original/normalized strings", () {
      final result = extractRoutingSync(RoutingInput(
        destination: baseG,
        memoType: 'text',
        memoValue: '00123',
      ));

      expect(result.source, equals(RoutingSource.memo));
      expect(result.idString, equals('123'));
      final warning = result.warnings
          .firstWhere((w) => w.code == WarningCode.nonCanonicalRoutingId);
      expect(warning.normalization?.original, equals('00123'));
      expect(warning.normalization?.normalized, equals('123'));
    });

    test("treats ' 123 ' as unroutable", () {
      final result = extractRoutingSync(RoutingInput(
        destination: baseG,
        memoType: 'text',
        memoValue: ' 123 ',
      ));

      expect(result.source, equals(RoutingSource.none));
      expect(result.id, isNull);
      expect(result.warnings.map((w) => w.code),
          equals([WarningCode.memoTextUnroutable]));
    });
  });
}
