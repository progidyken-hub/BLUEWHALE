# Flutter Wallet Deposit Screen

Reference Flutter UI demonstrating Bluewhale integration for Stellar wallet deposit address validation.

## Features

- Real-time address validation for G and M addresses
- Live routing analysis with memo support
- Visual warning system for Muxed vs Memo conflicts
- Responsive Material Design 3 UI
- QR code scanner integration placeholder

## Running

```bash
flutter pub get
flutter run
```

## Integration Points

The deposit screen shows how to:

1. Use `extractRoutingSync()` for real-time validation
2. Handle `RoutingResult` warnings with appropriate UI severity
3. Display routing ID resolution from M-addresses or memos
4. Integrate QR scanning (mock implementation provided)

## Architecture

- `main.dart` - Complete deposit screen with address input, memo fields, and real-time analysis
- Uses `bluewhale_core` package for all address validation and routing logic
- Material 3 design with severity-based warning cards

## Testing

Enter various address formats to see routing behavior:

- G-address with memo: extracts routing ID from memo
- M-address alone: extracts embedded routing ID
- M-address + memo: shows `MEMO_IGNORED_FOR_MUXED` warning
- Invalid addresses: displays structured error messages
