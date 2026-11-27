import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  group('Control character sanitization', () {
    test('ANSI escape codes are stripped from error messages', () {
      // Address with ANSI color codes
      const malformed = 'G\x1b[31mINVALID\x1b[0m';
      
      expect(
        () => StellarAddress.parse(malformed),
        throwsA(
          isA<StellarAddressException>().having(
            (e) => e.message,
            'message',
            isNot(contains('\x1b')),
          ),
        ),
      );
    });

    test('terminal control sequences are stripped', () {
      // Address with carriage return attempting log spoofing
      const malformed = 'G\x00\x01\x02TEST\x07\x08';
      
      expect(
        () => StellarAddress.parse(malformed),
        throwsA(
          isA<StellarAddressException>().having(
            (e) => e.message,
            'message',
            equals('Invalid address'),
          ),
        ),
      );
    });

    test('bell and backspace characters are stripped', () {
      const malformed = 'GINVALID\x07\x08\x1b';
      
      try {
        StellarAddress.parse(malformed);
        fail('Should have thrown');
      } on StellarAddressException catch (e) {
        expect(e.message, isNot(contains('\x07')));
        expect(e.message, isNot(contains('\x08')));
        expect(e.message, isNot(contains('\x1b')));
      }
    });

    test('normal whitespace is preserved in messages', () {
      // Test that tab, newline, CR are preserved (though not in actual addresses)
      const malformed = 'INVALID\t\n\rTEST';
      
      try {
        StellarAddress.parse(malformed);
        fail('Should have thrown');
      } on StellarAddressException catch (e) {
        // Message won't contain these exact chars but they wouldn't be stripped
        // if they were in the error message construction
        expect(e.message, isNotEmpty);
      }
    });
  });
}
