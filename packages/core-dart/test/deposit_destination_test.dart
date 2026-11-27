// DepositDestination JSON round-trip, equality and validation (#379).
import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

const _g = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';

void main() {
  group('DepositDestination', () {
    test('round-trips through toJson and fromJson with a routing ID', () {
      final original = DepositDestination(
        address: _g,
        kind: AddressKind.g,
        routingId: BigInt.parse('9007199254740993'),
      );
      final restored = DepositDestination.fromJson(original.toJson());
      expect(restored, original);
      expect(restored.routingId, BigInt.parse('9007199254740993'));
    });

    test('round-trips with no routing ID as an explicit null', () {
      const original = DepositDestination(address: _g, kind: AddressKind.g);
      final json = original.toJson();
      expect(json['routingId'], isNull);
      expect(DepositDestination.fromJson(json), original);
    });

    test('serializes the routing ID as a decimal string', () {
      final json = DepositDestination(
        address: _g,
        kind: AddressKind.g,
        routingId: BigInt.from(42),
      ).toJson();
      expect(json['routingId'], '42');
    });

    test('compares equal and hashes equal for identical fields', () {
      final a = DepositDestination(address: _g, kind: AddressKind.g, routingId: BigInt.one);
      final b = DepositDestination(address: _g, kind: AddressKind.g, routingId: BigInt.one);
      expect(a, b);
      expect(a.hashCode, b.hashCode);
    });

    test('differs when any field differs', () {
      const base = DepositDestination(address: _g, kind: AddressKind.g);
      expect(base == const DepositDestination(address: _g, kind: AddressKind.m), isFalse);
      expect(
        base == DepositDestination(address: _g, kind: AddressKind.g, routingId: BigInt.one),
        isFalse,
      );
    });

    test('rejects an unknown kind', () {
      expect(
        () => DepositDestination.fromJson(<Object?, Object?>{'address': _g, 'kind': 'x'}),
        throwsArgumentError,
      );
    });

    test('rejects a routing ID that is not a decimal integer', () {
      expect(
        () => DepositDestination.fromJson(<Object?, Object?>{
          'address': _g,
          'kind': 'g',
          'routingId': 'abc',
        }),
        throwsFormatException,
      );
    });
  });
}
