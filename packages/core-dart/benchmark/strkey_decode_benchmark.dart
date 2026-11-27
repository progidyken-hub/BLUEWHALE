// Base32 decode throughput for StrKey payloads (#378).
//
// Run on the VM and compare with the previous `indexOf` lookup:
//
//   dart run benchmark/strkey_decode_benchmark.dart
library;

import 'dart:typed_data';

import 'package:benchmark_harness/benchmark_harness.dart';
// Fixture generation only; not part of the measured code path.
import 'package:bluewhale_core/src/util/strkey.dart';

const _fixtureCount = 256;

class StrKeyDecodeBenchmark extends BenchmarkBase {
  StrKeyDecodeBenchmark() : super('StrKeyUtil.decodeBase32');

  final List<String> _fixtures = List<String>.generate(
    _fixtureCount,
    (i) => StrKeyUtil.encodeBase32(
      Uint8List.fromList(List<int>.generate(35, (j) => (i * 31 + j * 7) & 0xFF)),
    ),
  );

  var _index = 0;

  @override
  void run() {
    StrKeyUtil.decodeBase32(_fixtures[_index]);
    _index = (_index + 1) % _fixtureCount;
  }
}

void main() {
  StrKeyDecodeBenchmark().report();
}
