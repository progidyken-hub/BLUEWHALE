// Runs spec/vectors/empty-memos.json against core-dart. The same file is run
// by core-ts (src/spec/empty-memos.test.ts) and core-go
// (routing/empty_memos_vectors_test.go).
import 'dart:convert';
import 'dart:io';

import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  final spec = jsonDecode(
    File('../../spec/vectors/empty-memos.json').readAsStringSync(),
  ) as Map<String, dynamic>;
  final cases = (spec['cases'] as List<dynamic>).cast<Map<String, dynamic>>();

  test('has cases', () => expect(cases, isNotEmpty));

  group('spec/vectors/empty-memos.json', () {
    for (final c in cases) {
      test(c['id'] as String, () {
        final input = c['input'] as Map<String, dynamic>;
        final expected = c['expected'] as Map<String, dynamic>;
        final memoType = input['memoType'] as String;
        final memoValue = input['memoValue'] as String?;

        expect(effectiveMemoType(memoType, memoValue),
            expected['effectiveMemoType']);
        if (memoType == 'text') {
          expect(isBlankMemoText(memoValue),
              expected['effectiveMemoType'] == 'none');
        }

        final result = extractRouting(RoutingInput(
          destination: input['destination'] as String,
          memoType: memoType,
          memoValue: memoValue,
        ));

        expect(result.destinationBaseAccount,
            expected['destinationBaseAccount']);
        expect(result.id?.toString(), expected['routingId']);
        expect(result.source.name, expected['routingSource']);
        expect(
          [
            for (final w in result.warnings)
              {'code': w.code, 'severity': w.severity},
          ],
          [
            for (final w in expected['warnings'] as List<dynamic>)
              {
                'code': (w as Map<String, dynamic>)['code'],
                'severity': w['severity'],
              },
          ],
        );
      });
    }
  });
}
