import { classifyAddress } from '../src/classifier';

/**
 * Benchmarks comparing the zero-allocation prefix classifier fast path
 * against a full base32 decode of the same inputs.
 *
 * Run with: npx tsx bench/classifier.bench.ts
 */

const G_ADDRESS =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const M_ADDRESS =
  'MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const C_ADDRESS =
  'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const MALFORMED = 'not-a-stellar-address';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Full base32 decode used as the baseline for comparison. */
function fullBase32Decode(input: string): Uint8Array {
  const out = new Uint8Array(Math.floor((input.length * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (let i = 0; i < input.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(input[i]);
    if (idx === -1) {
      throw new Error('invalid base32');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return out;
}

function bench(name: string, iterations: number, fn: () => void): void {
  // Warm up.
  for (let i = 0; i < Math.min(iterations, 1000); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const perOp = (elapsed / iterations) * 1_000_000;
  console.log(
    `${name.padEnd(40)} ${elapsed.toFixed(2)}ms total  ${perOp.toFixed(3)}µs/op`,
  );
}

const ITERATIONS = 100_000;

console.log('classifier fast path vs full base32 decode');
console.log('-------------------------------------------');

bench('classify G (fast path)', ITERATIONS, () => classifyAddress(G_ADDRESS));
bench('classify M (fast path)', ITERATIONS, () => classifyAddress(M_ADDRESS));
bench('classify C (fast path)', ITERATIONS, () => classifyAddress(C_ADDRESS));
bench('classify malformed (fast path)', ITERATIONS, () =>
  classifyAddress(MALFORMED),
);

bench('full decode G', ITERATIONS, () => fullBase32Decode(G_ADDRESS));
bench('full decode M', ITERATIONS, () => fullBase32Decode(M_ADDRESS));
bench('full decode C', ITERATIONS, () => fullBase32Decode(C_ADDRESS));
bench('full decode malformed', ITERATIONS, () => {
  try {
    fullBase32Decode(MALFORMED);
  } catch {
    // expected
  }
});
