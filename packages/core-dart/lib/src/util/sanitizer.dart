/// Sanitizes a string by removing non-printable ASCII control characters.
///
/// Removes all ASCII control characters in the range 0x00-0x1F except for:
/// - Tab (0x09)
/// - Line Feed (0x0A)
/// - Carriage Return (0x0D)
///
/// This prevents terminal escape injection and log spoofing.
String sanitizeControlChars(String input) {
  if (input.isEmpty) return input;
  
  final buffer = StringBuffer();
  for (int i = 0; i < input.length; i++) {
    final code = input.codeUnitAt(i);
    if (code >= 0x20 || code == 0x09 || code == 0x0A || code == 0x0D) {
      buffer.writeCharCode(code);
    }
  }
  return buffer.toString();
}
