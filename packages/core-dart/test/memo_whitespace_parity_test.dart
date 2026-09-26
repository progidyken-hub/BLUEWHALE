// Memo whitespace / leading-zero parity suite.
//
// The same table is asserted in core-ts (src/test/memo-whitespace-parity.test.ts)
// and core-go (routing/memo_whitespace_parity_test.go).
import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  // input, normalized (null = unroutable), [original, normalized] warning or null
  final cases = <List<Object?>>[
    [' 123 ', null, null],
    [' 123', null, null],
    ['123 ', null, null],
    ['123\n', null, null],
    ['\t123', null, null],
    ['1 23', null, null],
    ['', null, null],
    ['00123', '123', ['00123', '123']],
    ['000', '0', ['000', '0']],
    ['0', '0', null],
    ['123', '123', null],
  ];

  group('normalizeMemoTextId whitespace/leading-zero parity', () {
    for (final c in cases) {
      final input = c[0] as String;
      final normalized = c[1] as String?;
      final warning = c[2] as List<String>?;
      test('handles ${input.codeUnits}', () {
        final r = normalizeMemoTextId(input);
        expect(r.normalized, normalized);
        if (warning == null) {
          expect(r.warnings, isEmpty);
        } else {
          expect(r.warnings, hasLength(1));
          expect(r.warnings.first.code, WarningCode.nonCanonicalRoutingId);
          expect(r.warnings.first.normalization?.original, warning[0]);
          expect(r.warnings.first.normalization?.normalized, warning[1]);
        }
      });
    }
  });
}
