# Conformance Test Vectors

This directory contains implementations that run the cross-language normative test vectors against various implementations of the Bluewhale.

> Building Bluewhale in another language (Rust, Python, Ruby, ...)? Use the language-agnostic conformance suite instead: `Dockerfile.conformance` and the stdin/stdout JSON protocol described in [docs/guides/conformance.md](../../docs/guides/conformance.md).

## Dart

The Dart implementation of the conformance test runner is located in the `dart` subdirectory.

```bash
cd dart
dart pub get
dart run bin/run.dart
```

This ensures that the `bluewhale_core` Dart package strictly complies with the specification vectors defined in `../../spec/vectors.json`.
