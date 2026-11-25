/// AOT vs JIT Compilation Benchmark — Issue #449
///
/// Measures Dart AOT (Ahead-of-Time) compilation speed versus JIT (Just-in-Time)
/// execution on ARM64 mobile targets by running the core Bluewhale operations
/// (muxed address encoding/decoding, address detection, routing extraction)
/// against a fixed corpus and reporting throughput in operations/second.
///
/// This benchmark is designed to run in both compilation modes:
///
///   JIT (Dart VM, typical in development and on host):
///     dart run benchmark/aot_vs_jit_benchmark.dart
///
///   AOT (native binary, typical in release Flutter / server):
///     dart compile exe benchmark/aot_vs_jit_benchmark.dart -o /tmp/bw_bench
///     /tmp/bw_bench
///
/// The output is machine-parseable JSON (via --json flag) and human-readable
/// text. CI runs in both modes and prints a comparison table so regressions
/// in mobile release performance are immediately visible.
///
/// Design goals:
///   1. Zero external dependencies — uses only package:bluewhale_core and
///      package:meta (already in pubspec).
///   2. Reproducible — fixed corpus, deterministic order, no I/O side effects.
///   3. Warm-up aware — each benchmark discards the first [kWarmupIterations]
///      runs to avoid measuring JIT compilation cost in the timed window.
///   4. Statistically sound — reports mean, min, max, and p99 latency plus
///      overall throughput so outliers are visible.
///   5. ARM64-annotated — flag names and comments reference the target arch
///      so the CI workflow can apply the right runner.

import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:bluewhale_core/bluewhale_core.dart';

// ─── Constants ───────────────────────────────────────────────────────────────

/// Number of warm-up iterations discarded before timing starts.
const kWarmupIterations = 500;

/// Number of timed iterations for each benchmark.
const kIterations = 10000;

// ─── Fixed corpus ────────────────────────────────────────────────────────────

/// Well-known G-address used throughout the spec/vectors.json corpus.
const kBaseG = 'GAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQADRSI';

/// Pre-encoded M-address for the 2^53+1 canary (from spec/vectors.json).
const kMuxedCanary = 'MAYCUYT553C5LHVE2XPW5GMEJT4BXGM7AHMJWLAPZP53KJO7EIQACABAAAAAAAAAAEVIG';

/// A valid C-address used to bench the detect() rejection path.
const kContractAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Computed at startup (cannot be const because it requires the crypto path).
late final String kMuxedId42;
late final String kMuxedIdMax;

// ─── Result model ────────────────────────────────────────────────────────────

class BenchmarkResult {
  final String name;
  final int iterations;
  final Duration totalTime;
  final List<int> latenciesUs; // per-iteration latency in microseconds

  const BenchmarkResult({
    required this.name,
    required this.iterations,
    required this.totalTime,
    required this.latenciesUs,
  });

  int get meanUs => totalTime.inMicroseconds ~/ iterations;
  int get minUs => latenciesUs.reduce(min);
  int get maxUs => latenciesUs.reduce(max);
  int get p99Us {
    final sorted = List<int>.from(latenciesUs)..sort();
    final idx = ((sorted.length - 1) * 0.99).round();
    return sorted[idx];
  }

  double get throughputOpsPerSec =>
      iterations / (totalTime.inMicroseconds / 1e6);

  Map<String, dynamic> toJson() => {
        'benchmark': name,
        'iterations': iterations,
        'totalTimeMs': totalTime.inMilliseconds,
        'throughputOpsPerSec': throughputOpsPerSec.round(),
        'latency': {
          'meanUs': meanUs,
          'minUs': minUs,
          'maxUs': maxUs,
          'p99Us': p99Us,
        },
      };

  @override
  String toString() {
    final tp = throughputOpsPerSec.round().toString().padLeft(10);
    final mean = meanUs.toString().padLeft(6);
    final p99 = p99Us.toString().padLeft(6);
    final mx = maxUs.toString().padLeft(6);
    return '  ${name.padRight(42)} '
        'throughput: $tp ops/s   '
        'mean: ${mean}µs   '
        'p99: ${p99}µs   '
        'max: ${mx}µs';
  }
}

// ─── Benchmark runner ────────────────────────────────────────────────────────

/// Runs [fn] for [kWarmupIterations] discarded iterations then [kIterations]
/// timed iterations. Returns a [BenchmarkResult].
BenchmarkResult runBenchmark(String name, void Function() fn) {
  // Warm-up: prevent JIT from attributing compile time to the first timed run.
  for (var i = 0; i < kWarmupIterations; i++) {
    fn();
  }

  final latencies = <int>[];
  latencies.length = kIterations; // pre-allocate to avoid GC pressure

  final totalStart = DateTime.now();

  for (var i = 0; i < kIterations; i++) {
    final iterStart = DateTime.now();
    fn();
    latencies[i] = DateTime.now().difference(iterStart).inMicroseconds;
  }

  final totalTime = DateTime.now().difference(totalStart);

  return BenchmarkResult(
    name: name,
    iterations: kIterations,
    totalTime: totalTime,
    latenciesUs: latencies,
  );
}

// ─── Benchmark definitions ────────────────────────────────────────────────────

List<BenchmarkResult> runAllBenchmarks() {
  final results = <BenchmarkResult>[];

  // ── 1. Muxed address encoding ────────────────────────────────────────────
  results.add(runBenchmark('muxed_encode(id=42)', () {
    MuxedAddress.encode(baseG: kBaseG, id: BigInt.from(42));
  }));

  results.add(runBenchmark('muxed_encode(id=2^53+1 canary)', () {
    MuxedAddress.encode(baseG: kBaseG, id: BigInt.parse('9007199254740993'));
  }));

  results.add(runBenchmark('muxed_encode(id=2^64-1 max)', () {
    MuxedAddress.encode(
      baseG: kBaseG,
      id: BigInt.parse('18446744073709551615'),
    );
  }));

  // ── 2. Muxed address decoding ────────────────────────────────────────────
  results.add(runBenchmark('muxed_decode(id=42)', () {
    MuxedAddress.decode(kMuxedId42);
  }));

  results.add(runBenchmark('muxed_decode(id=2^53+1 canary)', () {
    MuxedAddress.decode(kMuxedCanary);
  }));

  // ── 3. Address detection ─────────────────────────────────────────────────
  results.add(runBenchmark('detect(G-address)', () {
    detect(kBaseG);
  }));

  results.add(runBenchmark('detect(M-address)', () {
    detect(kMuxedId42);
  }));

  results.add(runBenchmark('detect(C-address)', () {
    detect(kContractAddress);
  }));

  results.add(runBenchmark('detect(lowercase G-address)', () {
    detect(kBaseG.toLowerCase());
  }));

  results.add(runBenchmark('detect(invalid short string)', () {
    detect('NOTAVALIDADDRESS');
  }));

  // ── 4. Routing extraction — G-address paths ──────────────────────────────
  results.add(runBenchmark('extractRoutingSync(G + memoType=none)', () {
    extractRoutingSync(RoutingInput(
      destination: kBaseG,
      memoType: 'none',
    ));
  }));

  results.add(runBenchmark('extractRoutingSync(G + memoType=id)', () {
    extractRoutingSync(RoutingInput(
      destination: kBaseG,
      memoType: 'id',
      memoValue: '12345',
    ));
  }));

  results.add(runBenchmark('extractRoutingSync(G + memoType=id canary)', () {
    extractRoutingSync(RoutingInput(
      destination: kBaseG,
      memoType: 'id',
      memoValue: '9007199254740993',
    ));
  }));

  results.add(runBenchmark('extractRoutingSync(G + memoType=text numeric)', () {
    extractRoutingSync(RoutingInput(
      destination: kBaseG,
      memoType: 'text',
      memoValue: '99999',
    ));
  }));

  results.add(runBenchmark('extractRoutingSync(G + memoType=text non-numeric)', () {
    extractRoutingSync(RoutingInput(
      destination: kBaseG,
      memoType: 'text',
      memoValue: 'order-ref-xyz',
    ));
  }));

  results.add(runBenchmark('extractRoutingSync(G + memoType=hash)', () {
    extractRoutingSync(RoutingInput(
      destination: kBaseG,
      memoType: 'hash',
      memoValue: 'abc123',
    ));
  }));

  // ── 5. Routing extraction — M-address path ───────────────────────────────
  results.add(runBenchmark('extractRoutingSync(M-address, no memo)', () {
    extractRoutingSync(RoutingInput(
      destination: kMuxedId42,
      memoType: 'none',
    ));
  }));

  results.add(runBenchmark('extractRoutingSync(M-address, conflicting memo)', () {
    extractRoutingSync(RoutingInput(
      destination: kMuxedId42,
      memoType: 'id',
      memoValue: '99999',
    ));
  }));

  // ── 6. Round-trip pipeline (encode → decode → route) ────────────────────
  results.add(runBenchmark('round-trip encode→decode→route (id=42)', () {
    final m = MuxedAddress.encode(baseG: kBaseG, id: BigInt.from(42));
    MuxedAddress.decode(m);
    extractRoutingSync(RoutingInput(destination: m, memoType: 'none'));
  }));

  results.add(runBenchmark('round-trip encode→decode→route (canary)', () {
    final m = MuxedAddress.encode(
      baseG: kBaseG,
      id: BigInt.parse('9007199254740993'),
    );
    MuxedAddress.decode(m);
    extractRoutingSync(RoutingInput(destination: m, memoType: 'none'));
  }));

  results.add(runBenchmark('round-trip encode→decode→route (max uint64)', () {
    final m = kMuxedIdMax;
    MuxedAddress.decode(m);
    extractRoutingSync(RoutingInput(destination: m, memoType: 'none'));
  }));

  return results;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

void main(List<String> args) {
  // Pre-compute addresses that require crypto (cannot be const).
  kMuxedId42 = MuxedAddress.encode(baseG: kBaseG, id: BigInt.from(42));
  kMuxedIdMax = MuxedAddress.encode(
    baseG: kBaseG,
    id: BigInt.parse('18446744073709551615'),
  );

  final jsonOutput = args.contains('--json');
  final mode = _detectCompilationMode();

  if (!jsonOutput) {
    _printHeader(mode);
  }

  final results = runAllBenchmarks();

  if (jsonOutput) {
    _printJson(results, mode);
  } else {
    _printTable(results, mode);
  }
}

/// Heuristic: in JIT mode `Platform.script` ends with `.dart`; in AOT it
/// is a compiled binary path. This is not guaranteed by the Dart spec but
/// is reliable in practice on all current platforms.
String _detectCompilationMode() {
  final script = Platform.script.path;
  if (script.endsWith('.dart')) return 'JIT';
  return 'AOT';
}

void _printHeader(String mode) {
  final sep = '═' * 76;
  stdout.writeln('\n$sep');
  stdout.writeln(
    '  Bluewhale Dart Benchmark  —  ${mode.padRight(3)}  —  ${_archLabel()}',
  );
  stdout.writeln(
    '  Dart SDK: ${Platform.version.split(' ').first.padRight(10)}'
    '  OS: ${Platform.operatingSystem}',
  );
  stdout.writeln(
    '  Warm-up: $kWarmupIterations iters   Timed: $kIterations iters per benchmark',
  );
  stdout.writeln(sep);
}

String _archLabel() {
  // Platform.operatingSystemVersion often includes the arch on mobile/server.
  final v = Platform.operatingSystemVersion;
  if (v.contains('arm64') || v.contains('aarch64')) return 'ARM64';
  if (v.contains('arm')) return 'ARM32';
  if (v.contains('x86_64') || v.contains('x64')) return 'x86-64';
  return 'unknown-arch';
}

void _printTable(List<BenchmarkResult> results, String mode) {
  stdout.writeln('\n  Mode: $mode\n');
  for (final r in results) {
    stdout.writeln(r.toString());
  }
  stdout.writeln('\n  Benchmarks: ${results.length}  |  Mode: $mode');
  stdout.writeln('═' * 76);
}

void _printJson(List<BenchmarkResult> results, String mode) {
  final output = {
    'meta': {
      'mode': mode,
      'arch': _archLabel(),
      'dartVersion': Platform.version.split(' ').first,
      'os': Platform.operatingSystem,
      'warmupIterations': kWarmupIterations,
      'timedIterations': kIterations,
      'timestamp': DateTime.now().toIso8601String(),
    },
    'benchmarks': results.map((r) => r.toJson()).toList(),
  };
  stdout.writeln(const JsonEncoder.withIndent('  ').convert(output));
}
