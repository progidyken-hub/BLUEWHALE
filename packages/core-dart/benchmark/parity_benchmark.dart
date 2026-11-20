// Cross-language parity benchmarks (Dart leg).
//
// The workloads, inputs and names here MUST stay identical to:
//   packages/core-ts/bench/parity.bench.ts
//   packages/core-go/{address,muxed,routing}/parity_bench_test.go
//
// Prints one JSON object per workload to stdout:
//   {"workload":"parse_g","opsPerSec":1234567.8,"iterations":...,"elapsedUs":...}
//
//   dart run benchmark/parity_benchmark.dart [secondsPerWorkload]
//
// Run all three languages on the same host with
// scripts/run-parity-benchmarks.sh.
library;

import 'dart:convert';
import 'dart:io';

import 'package:bluewhale_core/bluewhale_core.dart';

const _gAddress = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';
const _mAddress =
    'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG';
const _memoId = '9007199254740993';

/// Keeps results observable so the compiler cannot eliminate the work.
Object? _sink;

final _workloads = <String, void Function()>{
  'parse_g': () => _sink = parse(_gAddress),
  'parse_m': () => _sink = parse(_mAddress),
  'decode_muxed': () => _sink = MuxedDecoder.decodeMuxedString(_mAddress),
  'extract_routing_memo_id': () => _sink = extractRouting(
        RoutingInput(
          destination: _gAddress,
          memoType: 'id',
          memoValue: _memoId,
        ),
      ),
};

/// Runs [op] in batches until [budget] has elapsed and returns ops/sec.
Map<String, Object> _measure(String name, void Function() op, Duration budget) {
  const batch = 1000;

  // Warm-up: give the JIT the same chance V8 and Go get before timing.
  final warmup = Stopwatch()..start();
  while (warmup.elapsed < budget ~/ 4) {
    for (var i = 0; i < batch; i++) {
      op();
    }
  }

  var iterations = 0;
  final sw = Stopwatch()..start();
  while (sw.elapsed < budget) {
    for (var i = 0; i < batch; i++) {
      op();
    }
    iterations += batch;
  }
  sw.stop();

  final elapsedUs = sw.elapsedMicroseconds;
  return {
    'workload': name,
    'opsPerSec': iterations / (elapsedUs / Duration.microsecondsPerSecond),
    'iterations': iterations,
    'elapsedUs': elapsedUs,
  };
}

void main(List<String> args) {
  final seconds = args.isNotEmpty ? double.parse(args.first) : 1.0;
  final budget = Duration(microseconds: (seconds * 1e6).round());

  for (final entry in _workloads.entries) {
    stdout.writeln(jsonEncode(_measure(entry.key, entry.value, budget)));
  }
  if (_sink == null) stderr.writeln('unreachable');
}
