// RoutingResult.copyWith keeps unchanged fields and honours explicit nulls (#380).
import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  final base = RoutingResult(
    source: RoutingSource.memo,
    id: BigInt.from(7),
    warnings: [RoutingWarning.missingRequiredMemo],
    destinationBaseAccount: 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI',
  );

  group('RoutingResult.copyWith', () {
    test('keeps every field when called with no arguments', () {
      expect(base.copyWith(), base);
    });

    test('replaces only the fields given', () {
      final copy = base.copyWith(source: RoutingSource.muxed);
      expect(copy.source, RoutingSource.muxed);
      expect(copy.id, base.id);
      expect(copy.destinationBaseAccount, base.destinationBaseAccount);
    });

    test('clears a nullable field when passed an explicit null', () {
      final copy = base.copyWith(id: null, destinationBaseAccount: null);
      expect(copy.id, isNull);
      expect(copy.destinationBaseAccount, isNull);
    });

    test('keeps a nullable field when the argument is omitted', () {
      final copy = base.copyWith(source: RoutingSource.none);
      expect(copy.id, BigInt.from(7));
    });

    test('replaces warnings and leaves the original untouched', () {
      final copy = base.copyWith(warnings: const []);
      expect(copy.warnings, isEmpty);
      expect(base.warnings, hasLength(1));
    });

    test('equals a freshly constructed result with the same values', () {
      final copy = base.copyWith(id: BigInt.from(8));
      final direct = RoutingResult(
        source: base.source,
        id: BigInt.from(8),
        warnings: base.warnings,
        destinationBaseAccount: base.destinationBaseAccount,
      );
      expect(copy, direct);
      expect(copy.hashCode, direct.hashCode);
    });
  });
}
