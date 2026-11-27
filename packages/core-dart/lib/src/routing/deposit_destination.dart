import '../address/codes.dart' show AddressKind;

/// A resolved deposit target: the address that receives funds plus an optional
/// routing ID. Immutable, with JSON round-trip and value equality on every field.
final class DepositDestination {
  /// The address that receives the deposit (`G`, `M` or `C` StrKey).
  final String address;

  /// The kind of [address].
  final AddressKind kind;

  /// The routing ID, or null when the deposit carries none.
  final BigInt? routingId;

  const DepositDestination({
    required this.address,
    required this.kind,
    this.routingId,
  });

  /// Deserializes a destination written by [toJson].
  ///
  /// Throws [ArgumentError] for an unknown [kind] and [FormatException] for a
  /// [routingId] that is not a decimal integer.
  factory DepositDestination.fromJson(Map<Object?, Object?> json) {
    final rawId = json['routingId'];
    BigInt? routingId;
    if (rawId != null) {
      routingId = rawId is String ? BigInt.tryParse(rawId) : null;
      if (routingId == null) {
        throw FormatException('routingId must be a decimal string', rawId);
      }
    }
    return DepositDestination(
      address: json['address'] as String,
      kind: AddressKind.values.byName(json['kind'] as String),
      routingId: routingId,
    );
  }

  /// Serializes this destination. [routingId] is a decimal string, never a number,
  /// so it survives JS `Number` conversion on Flutter Web.
  Map<String, dynamic> toJson() => <String, dynamic>{
        'address': address,
        'kind': kind.name,
        'routingId': routingId?.toString(),
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DepositDestination &&
          address == other.address &&
          kind == other.kind &&
          routingId == other.routingId;

  @override
  int get hashCode => Object.hash(address, kind, routingId);

  @override
  String toString() => 'DepositDestination($address, ${kind.name}, $routingId)';
}
