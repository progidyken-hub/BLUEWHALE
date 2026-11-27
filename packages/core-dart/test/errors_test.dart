import 'package:core_dart/src/errors.dart';
import 'package:test/test.dart';

void main() {
  group('BluewhaleException', () {
    test('exposes message and recovery suggestion', () {
      const exception = BluewhaleException(
        'boom',
        recoverySuggestion: 'try again',
      );

      expect(exception.message, 'boom');
      expect(exception.recoverySuggestion, 'try again');
      expect(exception.toString(), contains('boom'));
      expect(exception.toString(), contains('try again'));
    });
  });

  group('InvalidAddressException', () {
    test('is a BluewhaleException with a recovery suggestion', () {
      const exception = InvalidAddressException('GINVALID');

      expect(exception, isA<BluewhaleException>());
      expect(exception.address, 'GINVALID');
      expect(exception.message, contains('GINVALID'));
      expect(exception.recoverySuggestion, isNotEmpty);
    });

    test('can be thrown and caught as BluewhaleException', () {
      void deposit() => throw const InvalidAddressException('GINVALID');

      expect(
        deposit,
        throwsA(
          isA<BluewhaleException>()
              .having((e) => e.recoverySuggestion, 'recoverySuggestion',
                  isNotEmpty),
        ),
      );
    });
  });

  group('UnsupportedMemoException', () {
    test('is a BluewhaleException with a recovery suggestion', () {
      const exception = UnsupportedMemoException(memo: 'hello');

      expect(exception, isA<BluewhaleException>());
      expect(exception.memo, 'hello');
      expect(exception.message, contains('hello'));
      expect(exception.recoverySuggestion, isNotEmpty);
    });

    test('can be thrown and caught as BluewhaleException', () {
      void deposit() => throw const UnsupportedMemoException();

      expect(
        deposit,
        throwsA(
          isA<BluewhaleException>()
              .having((e) => e.recoverySuggestion, 'recoverySuggestion',
                  isNotEmpty),
        ),
      );
    });
  });
}
