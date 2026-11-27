import 'package:meta/meta.dart';

/// Maximum value of a 64-bit unsigned integer (2^64 - 1).
final BigInt _maxUint64 = (BigInt.one << 64) - BigInt.one;

/// A muxed address (M-address) as defined by SEP-23.
///
/// A muxed address combines a base G-address with a 64-bit unsigned
/// subaccount ID. The subaccount ID is stored as a [BigInt] so that values
/// greater than 2^53 are preserved with full precision on Dart Web
/// (JS / WASM), where `int` is backed by a double.
@immutable
class MuxedAddress {
  /// The underlying G-address (e.g. `GABC...`).
  final String address;

  /// The 64-bit unsigned subaccount ID.
  final BigInt id;

  MuxedAddress(this.address, BigInt id) : id = _validateId(id);

  /// Creates a [MuxedAddress] from an [int] subaccount ID.
  ///
  /// Prefer passing a [BigInt] directly to avoid precision loss on Dart Web
  /// for values greater than 2^53.
  factory MuxedAddress.fromInt(String address, int id) =>
      MuxedAddress(address, BigInt.from(id));

  /// Creates a [MuxedAddress] from a decimal string subaccount ID.
  factory MuxedAddress.fromString(String address, String id) =>
      MuxedAddress(address, BigInt.parse(id));

  static BigInt _validateId(BigInt id) {
    if (id.isNegative) {
      throw ArgumentError.value(id, 'id', 'Subaccount ID must be non-negative');
    }
    if (id > _maxUint64) {
      throw ArgumentError.value(
          id, 'id', 'Subaccount ID must fit in an unsigned 64-bit integer');
    }
    return id;
  }

  /// The subaccount ID encoded as a decimal string.
  String get idString => id.toString();

  @override
  bool operator ==(Object other) =>
      other is MuxedAddress && other.address == address && other.id == id;

  @override
  int get hashCode => Object.hash(address, id);

  @override
  String toString() => 'MuxedAddress($address, $id)';
}
