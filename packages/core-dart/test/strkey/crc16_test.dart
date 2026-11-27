import 'dart:typed_data';

import 'package:test/test.dart';
import 'package:core_dart/src/strkey/crc16.dart';

void main() {
  group('Crc16', () {
    test('computes known CRC16-XModem value', () {
      final data = Uint8List.fromList('123456789'.codeUnits);
      expect(Crc16.compute(data), 0x31C3);
    });

    test('empty input yields initial value', () {
      expect(Crc16.compute(Uint8List(0)), 0x0000);
    });
  });

  group('constantTimeCompare', () {
    test('returns true for equal buffers', () {
      final a = Uint8List.fromList([1, 2, 3, 4]);
      final b = Uint8List.fromList([1, 2, 3, 4]);
      expect(constantTimeCompare(a, b), isTrue);
    });

    test('returns true for two empty buffers', () {
      expect(constantTimeCompare(Uint8List(0), Uint8List(0)), isTrue);
    });

    test('returns false when a byte differs', () {
      final a = Uint8List.fromList([1, 2, 3, 4]);
      final b = Uint8List.fromList([1, 2, 9, 4]);
      expect(constantTimeCompare(a, b), isFalse);
    });

    test('returns false when the last byte differs', () {
      final a = Uint8List.fromList([1, 2, 3, 4]);
      final b = Uint8List.fromList([1, 2, 3, 5]);
      expect(constantTimeCompare(a, b), isFalse);
    });

    test('returns false on length mismatch', () {
      final a = Uint8List.fromList([1, 2, 3, 4]);
      final b = Uint8List.fromList([1, 2, 3]);
      expect(constantTimeCompare(a, b), isFalse);
    });

    test('returns false when one buffer is empty', () {
      final a = Uint8List.fromList([1]);
      final b = Uint8List(0);
      expect(constantTimeCompare(a, b), isFalse);
    });
  });
}
