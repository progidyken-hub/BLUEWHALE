import 'package:core_dart/src/sep0029/resolver.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

void main() {
  group('Sep29Resolver.isValidDomain', () {
    test('accepts valid domains', () {
      expect(Sep29Resolver.isValidDomain('example.com'), isTrue);
      expect(Sep29Resolver.isValidDomain('sub.example.co.uk'), isTrue);
      expect(Sep29Resolver.isValidDomain('a-b.example.com'), isTrue);
    });

    test('rejects invalid domains', () {
      expect(Sep29Resolver.isValidDomain(''), isFalse);
      expect(Sep29Resolver.isValidDomain('localhost'), isFalse);
      expect(Sep29Resolver.isValidDomain('-bad.example.com'), isFalse);
      expect(Sep29Resolver.isValidDomain('bad-.example.com'), isFalse);
      expect(Sep29Resolver.isValidDomain('bad_underscore.com'), isFalse);
      expect(Sep29Resolver.isValidDomain('a..b.com'), isFalse);
    });
  });

  group('Sep29Resolver.resolve', () {
    test('short-circuits network for invalid domain', () async {
      var called = false;
      final client = MockClient((_) async {
        called = true;
        return http.Response('', 200);
      });
      final resolver = Sep29Resolver(client: client);

      await expectLater(
        resolver.resolve('not_a_domain'),
        throwsA(isA<Sep29Exception>()),
      );
      expect(called, isFalse);
    });

    test('parses stellar.toml on success', () async {
      final client = MockClient((request) async {
        expect(request.url.toString(),
            'https://example.com/.well-known/stellar.toml');
        return http.Response('ORG_NAME="Example"\n# comment\n', 200);
      });
      final resolver = Sep29Resolver(client: client);

      final config = await resolver.resolve('example.com');
      expect(config['ORG_NAME'], 'Example');
    });

    test('throws on non-200 response', () async {
      final client = MockClient((_) async => http.Response('nope', 404));
      final resolver = Sep29Resolver(client: client);

      await expectLater(
        resolver.resolve('example.com'),
        throwsA(isA<Sep29Exception>()),
      );
    });
  });
}
