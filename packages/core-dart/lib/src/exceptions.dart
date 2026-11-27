import 'util/sanitizer.dart';

/// Thrown when a Stellar address or muxed ID is malformed or out of range.
///
/// Raised by `StellarAddress.parse`, `MuxedAddress.encode`, and
/// `MuxedAddress.decode`. The non-throwing `detect`, `validate`, and `parse`
/// functions never raise it.
///
/// All error messages containing user input are automatically sanitized to
/// remove ASCII control characters (0x00-0x1F, excluding standard whitespace)
/// to prevent terminal escape injection and log spoofing.
///
/// ```dart
/// try {
///   StellarAddress.parse('not-an-address');
/// } on StellarAddressException catch (e) {
///   print(e.message); // Invalid address
/// }
/// ```
class StellarAddressException implements Exception {
  /// A human-readable description of what was wrong with the input.
  /// This message is automatically sanitized to remove control characters.
  final String message;

  /// Creates an exception carrying [message].
  /// The message is sanitized to remove ASCII control characters (0x00-0x1F)
  /// except for tab, line feed, and carriage return.
  StellarAddressException(String message)
      : message = sanitizeControlChars(message);

  /// Creates a const exception with a pre-sanitized [message].
  /// Use this constructor only for constant error messages that don't
  /// contain user input.
  const StellarAddressException._(this.message);

  @override
  String toString() => 'StellarAddressException: $message';
}
