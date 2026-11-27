/// Base exception for all Bluewhale deposit routing failures.
///
/// Carries a human-readable [message] and a detailed [recoverySuggestion]
/// that wallet apps can surface (and localize) to guide the user.
class BluewhaleException implements Exception {
  /// Human-readable description of what went wrong.
  final String message;

  /// Detailed suggestion describing how the user can recover.
  final String recoverySuggestion;

  /// Optional underlying cause for debugging.
  final Object? cause;

  const BluewhaleException(
    this.message, {
    required this.recoverySuggestion,
    this.cause,
  });

  @override
  String toString() {
    final buffer = StringBuffer('$runtimeType: $message');
    if (recoverySuggestion.isNotEmpty) {
      buffer.write('\nRecovery: $recoverySuggestion');
    }
    if (cause != null) {
      buffer.write('\nCause: $cause');
    }
    return buffer.toString();
  }
}

/// Thrown when a deposit destination address is malformed or invalid.
class InvalidAddressException extends BluewhaleException {
  /// The address that failed validation, if available.
  final String? address;

  const InvalidAddressException(
    String message, {
    required String recoverySuggestion,
    this.address,
    Object? cause,
  }) : super(message, recoverySuggestion: recoverySuggestion, cause: cause);
}

/// Thrown when a deposit memo is unsupported or missing for the destination.
class UnsupportedMemoException extends BluewhaleException {
  /// The memo that was rejected, if available.
  final String? memo;

  const UnsupportedMemoException(
    String message, {
    required String recoverySuggestion,
    this.memo,
    Object? cause,
  }) : super(message, recoverySuggestion: recoverySuggestion, cause: cause);
}
