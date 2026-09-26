// Error code taxonomy parity: the same literals are asserted in core-ts
// (src/test/error-code-parity.test.ts) and core-go
// (address/error_code_parity_test.go), and match spec/schema.json.
import 'package:bluewhale_core/bluewhale_core.dart';
import 'package:test/test.dart';

void main() {
  test('ErrorCode literals match the cross-SDK taxonomy', () {
    expect(ErrorCode.invalidChecksum, 'INVALID_CHECKSUM');
    expect(ErrorCode.invalidLength, 'INVALID_LENGTH');
    expect(ErrorCode.invalidBase32, 'INVALID_BASE32');
    expect(ErrorCode.unknownPrefix, 'UNKNOWN_PREFIX');
    expect(ErrorCode.rejectedSeedKey, 'REJECTED_SEED_KEY');
    expect(ErrorCode.rejectedPreauth, 'REJECTED_PREAUTH');
    expect(ErrorCode.rejectedHashX, 'REJECTED_HASH_X');
    expect(ErrorCode.federationAddressNotSupported,
        'FEDERATION_ADDRESS_NOT_SUPPORTED');
  });
}
