// Cross-SDK parity for address-parse error codes. The canonical list lives
// in the `errorCode` definition of spec/schema.json and is also checked by
// core-ts (src/address/errors.test.ts) and core-go (address/errors_test.go).
library;

import 'dart:convert';
import 'dart:io';

import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  final schema = jsonDecode(File('../../spec/schema.json').readAsStringSync())
      as Map<String, dynamic>;
  final schemaCodes =
      ((schema['definitions'] as Map<String, dynamic>)['errorCode']
          as Map<String, dynamic>)['enum'] as List<dynamic>;

  group('AddressErrorCode', () {
    test('matches the errorCode enum in spec/schema.json exactly', () {
      expect(
          AddressErrorCode.values.map((AddressErrorCode c) => c.code).toList(),
          equals(schemaCodes));
    });

    test('mirrors the ErrorCode string constants', () {
      expect(AddressErrorCode.unknownPrefix.code, ErrorCode.unknownPrefix);
      expect(AddressErrorCode.invalidChecksum.code, ErrorCode.invalidChecksum);
      expect(AddressErrorCode.invalidLength.code, ErrorCode.invalidLength);
      expect(AddressErrorCode.invalidBase32.code, ErrorCode.invalidBase32);
      expect(AddressErrorCode.rejectedSeedKey.code, ErrorCode.rejectedSeedKey);
      expect(AddressErrorCode.rejectedPreauth.code, ErrorCode.rejectedPreauth);
      expect(AddressErrorCode.rejectedHashX.code, ErrorCode.rejectedHashX);
      expect(AddressErrorCode.federationAddressNotSupported.code,
          ErrorCode.federationAddressNotSupported);
    });

    test('tryParse round-trips canonical codes and rejects others', () {
      for (final c in AddressErrorCode.values) {
        expect(AddressErrorCode.tryParse(c.code), same(c));
      }
      expect(AddressErrorCode.tryParse('invalid_checksum'), isNull);
      expect(AddressErrorCode.tryParse('UNKNOWN'), isNull);
      expect(AddressErrorCode.tryParse(null), isNull);
    });

    test('destinationError codes are canonical', () {
      final result = extractRoutingSync(RoutingInput(
        destination: 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSJ',
        memoType: 'none',
      ));
      expect(result.destinationError, isNotNull);
      expect(result.destinationError!.errorCode, isNotNull,
          reason: 'code "${result.destinationError!.code}" is not canonical');
    });
  });
}
