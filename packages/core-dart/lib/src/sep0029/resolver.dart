import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Resolves and validates SEP-0029 `stellar.toml` configurations for a domain.
///
/// Domains are validated against RFC 1035 rules before any network lookup is
/// performed, so invalid input never triggers an HTTP request. The underlying
/// [http.Client] is injectable to allow SSL pinning or custom transports.
class Sep29Resolver {
  Sep29Resolver({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static final RegExp _labelPattern = RegExp(r'^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$');

  /// Validates [domain] against RFC 1035 rules.
  ///
  /// Returns `true` when the domain is a syntactically valid hostname:
  /// total length 1-253, at least two labels, each label 1-63 characters,
  /// labels composed of alphanumerics and hyphens, and no label starting or
  /// ending with a hyphen.
  static bool isValidDomain(String domain) {
    if (domain.isEmpty || domain.length > 253) return false;
    final labels = domain.split('.');
    if (labels.length < 2) return false;
    for (final label in labels) {
      if (label.isEmpty || label.length > 63) return false;
      if (!_labelPattern.hasMatch(label)) return false;
    }
    return true;
  }

  /// Fetches and parses the `stellar.toml` for [domain].
  ///
  /// Throws an [ArgumentError] if [domain] is not a valid RFC 1035 hostname,
  /// and a [Sep29Exception] if the lookup fails or returns a non-200 status.
  Future<Sep29Config> resolve(String domain) async {
    if (!isValidDomain(domain)) {
      throw ArgumentError.value(domain, 'domain', 'Invalid RFC 1035 domain');
    }

    final uri = Uri.https(domain, '/.well-known/stellar.toml');
    final http.Response response;
    try {
      response = await _client.get(uri);
    } catch (e) {
      throw Sep29Exception('Failed to fetch stellar.toml for $domain: $e');
    }

    if (response.statusCode != 200) {
      throw Sep29Exception(
        'Unexpected status ${response.statusCode} fetching stellar.toml for $domain',
      );
    }

    return Sep29Config.parse(domain, response.body);
  }

  /// Releases the underlying HTTP client.
  void close() => _client.close();
}

/// Parsed SEP-0029 `stellar.toml` configuration for a domain.
class Sep29Config {
  Sep29Config({required this.domain, required this.raw, required this.fields});

  /// The domain this configuration was resolved from.
  final String domain;

  /// The raw TOML body returned by the server.
  final String raw;

  /// Top-level key/value pairs parsed from the TOML body.
  final Map<String, String> fields;

  /// Parses a minimal subset of TOML: top-level `key = "value"` pairs.
  factory Sep29Config.parse(String domain, String body) {
    final fields = <String, String>{};
    for (final line in const LineSplitter().convert(body)) {
      final trimmed = line.trim();
      if (trimmed.isEmpty || trimmed.startsWith('#') || trimmed.startsWith('[')) {
        continue;
      }
      final eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      final key = trimmed.substring(0, eq).trim();
      var value = trimmed.substring(eq + 1).trim();
      if (value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'")))) {
        value = value.substring(1, value.length - 1);
      }
      fields[key] = value;
    }
    return Sep29Config(domain: domain, raw: body, fields: fields);
  }
}

/// Error raised when a SEP-0029 lookup fails.
class Sep29Exception implements Exception {
  Sep29Exception(this.message);

  final String message;

  @override
  String toString() => 'Sep29Exception: $message';
}
