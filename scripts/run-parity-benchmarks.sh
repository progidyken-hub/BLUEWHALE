#!/usr/bin/env bash
#
# Cross-language throughput (ops/sec) parity benchmarks.
#
# Runs the same four workloads, with the same inputs, in every implementation
# on the current host, one runtime after another so they share identical
# hardware conditions:
#
#   TypeScript  vitest bench   packages/core-ts/bench/parity.bench.ts
#   Go          go test -bench packages/core-go/*/parity_bench_test.go
#   Dart        dart run       packages/core-dart/benchmark/parity_benchmark.dart
#
# and writes a comparison table + charts to docs/benchmarks/parity.mdx.
#
# Usage:
#   scripts/run-parity-benchmarks.sh [--output FILE] [--time SECONDS]
#                                    [--skip ts|go|dart]...
#
# Environment:
#   BENCH_TIME   Seconds measured per workload per runtime (default: 1).
#   PIN_CPU      CPU index to pin every runtime to with taskset (Linux), e.g.
#                PIN_CPU=2. Reduces scheduler noise between runtimes.
#   OUTPUT       Report path (default: docs/benchmarks/parity.mdx).
#
# A runtime that is not installed, or whose package fails to build, is
# reported as "n/a" with the reason; the remaining runtimes still run. The
# script exits non-zero only if no runtime produced any result.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BENCH_TIME="${BENCH_TIME:-1}"
OUTPUT="${OUTPUT:-${REPO_ROOT}/docs/benchmarks/parity.mdx}"
SKIP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT="$2"; shift 2 ;;
    --time) BENCH_TIME="$2"; shift 2 ;;
    --skip) SKIP="${SKIP} $2"; shift 2 ;;
    -h|--help) sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if ! [[ "${BENCH_TIME}" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "BENCH_TIME must be a positive number of seconds, got '${BENCH_TIME}'" >&2
  exit 2
fi

command -v node >/dev/null 2>&1 || { echo "node is required to render the report" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# results.tsv: <runtime>\t<workload>\t<ops_per_sec>
RESULTS="${WORK}/results.tsv"
# status.tsv:  <runtime>\t<ok|skipped|failed>\t<version or reason>
STATUS="${WORK}/status.tsv"
: >"${RESULTS}"
: >"${STATUS}"

log() { printf '[parity-bench] %s\n' "$*" >&2; }

PIN=()
if [[ -n "${PIN_CPU:-}" ]]; then
  if command -v taskset >/dev/null 2>&1; then
    PIN=(taskset -c "${PIN_CPU}")
    log "pinning all runtimes to CPU ${PIN_CPU}"
  else
    log "PIN_CPU set but taskset not found; running unpinned"
  fi
fi

skipped() { [[ " ${SKIP} " == *" $1 "* ]]; }

status() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"${STATUS}"; }

# Last non-empty line of a log, tab-free, for the failure reason column.
# Appends {"workload","opsPerSec"} JSON lines from $2 to results as runtime $1.
jsonl_to_tsv() {
  [[ -s "$2" ]] || return 0
  node -e '
    for (const line of require("fs").readFileSync(process.argv[2], "utf8").split("\n")) {
      if (!line.startsWith("{")) continue;
      const r = JSON.parse(line);
      if (r.opsPerSec > 0) console.log([process.argv[1], r.workload, r.opsPerSec].join("\t"));
    }
  ' "$1" "$2" >>"${RESULTS}"
}

reason_from() { grep -v '^\s*$' "$1" | tail -n 1 | tr '\t' ' ' | cut -c1-160; }

# ---------------------------------------------------------------------------
# TypeScript: vitest bench
# ---------------------------------------------------------------------------
bench_ts() {
  local dir="${REPO_ROOT}/packages/core-ts"
  if skipped ts; then status ts skipped "--skip ts"; return; fi
  if [[ ! -x "${dir}/node_modules/.bin/vitest" ]]; then
    status ts skipped "vitest not installed (run pnpm install)"; return
  fi

  log "ts: vitest bench (${BENCH_TIME}s per workload)"
  local jsonl="${WORK}/ts.jsonl" rc=0
  (cd "${dir}" && PARITY_BENCH_TIME_MS="$(node -e "console.log(Math.round(${BENCH_TIME} * 1000))")" \
      PARITY_BENCH_OUTPUT="${jsonl}" \
      ${PIN[@]+"${PIN[@]}"} ./node_modules/.bin/vitest bench --run bench/parity.bench.ts) \
      >"${WORK}/ts.log" 2>&1 || rc=$?

  jsonl_to_tsv ts "${jsonl}"
  local version="Node $(node --version), vitest $(cd "${dir}" && node -p 'require("vitest/package.json").version')"
  if [[ ${rc} -ne 0 ]]; then
    status ts failed "${version}; $(grep -m1 -E 'Error' "${WORK}/ts.log" | sed 's/^[[:space:]]*//' | tr '\t' ' ' | cut -c1-160)"
  else
    status ts ok "${version}"
  fi
}

# ---------------------------------------------------------------------------
# Go: go test -bench
# ---------------------------------------------------------------------------
bench_go() {
  local dir="${REPO_ROOT}/packages/core-go"
  if skipped go; then status go skipped "--skip go"; return; fi
  if ! command -v go >/dev/null 2>&1; then status go skipped "go not installed"; return; fi

  log "go: go test -bench (${BENCH_TIME}s per workload)"
  # One invocation per package: a build failure in one package must not stop
  # the others from being measured.
  local pkg failed=""
  for pkg in address muxed routing; do
    if ! (cd "${dir}" && ${PIN[@]+"${PIN[@]}"} go test -run '^$' -bench '^BenchmarkParity_' \
          -benchtime "${BENCH_TIME}s" -benchmem "./${pkg}") >"${WORK}/go-${pkg}.log" 2>&1; then
      failed="${failed} ${pkg}"
    fi
    # BenchmarkParity_parse_g-8   1234567   950.2 ns/op   ...
    awk '/^BenchmarkParity_/ {
           name = $1; sub(/^BenchmarkParity_/, "", name); sub(/-[0-9]+$/, "", name);
           for (i = 2; i < NF; i++) if ($(i+1) == "ns/op") { printf "go\t%s\t%.2f\n", name, 1e9 / $i }
         }' "${WORK}/go-${pkg}.log" >>"${RESULTS}"
  done

  if [[ -n "${failed}" ]]; then
    status go failed "$(go version | awk '{print $3}'); package(s) failed to build or run:${failed}"
  else
    status go ok "$(go version | awk '{print $3}')"
  fi
}

# ---------------------------------------------------------------------------
# Dart: dart run
# ---------------------------------------------------------------------------
bench_dart() {
  local dir="${REPO_ROOT}/packages/core-dart"
  if skipped dart; then status dart skipped "--skip dart"; return; fi
  if ! command -v dart >/dev/null 2>&1; then status dart skipped "dart not installed"; return; fi

  log "dart: dart run benchmark (${BENCH_TIME}s per workload)"
  if ! (cd "${dir}" && dart pub get >/dev/null && \
        ${PIN[@]+"${PIN[@]}"} dart run benchmark/parity_benchmark.dart "${BENCH_TIME}") \
        >"${WORK}/dart.log" 2>"${WORK}/dart.err"; then
    status dart failed "$(reason_from "${WORK}/dart.err")"; return
  fi

  jsonl_to_tsv dart "${WORK}/dart.log"
  status dart ok "$(dart --version 2>&1 | sed -E 's/.*version: ([^ ]+).*/Dart \1/')"
}

bench_ts
bench_go
bench_dart

if [[ ! -s "${RESULTS}" ]]; then
  log "no runtime produced results:"
  cat "${STATUS}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Render report
# ---------------------------------------------------------------------------
CPU_MODEL="$( (grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^ *//') \
              || sysctl -n machdep.cpu.brand_string 2>/dev/null || echo unknown)"
[[ -n "${CPU_MODEL}" ]] || CPU_MODEL="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo unknown)"
CPU_COUNT="$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo '?')"
OS_NAME="$(uname -srm)"
GIT_REV="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain -- packages 2>/dev/null)" ]]; then
  GIT_REV="${GIT_REV} (+ uncommitted changes under packages/)"
fi

mkdir -p "$(dirname "${OUTPUT}")"
CPU_MODEL="${CPU_MODEL}" CPU_COUNT="${CPU_COUNT}" OS_NAME="${OS_NAME}" GIT_REV="${GIT_REV}" \
BENCH_TIME="${BENCH_TIME}" PIN_CPU="${PIN_CPU:-}" \
node - "${RESULTS}" "${STATUS}" "${OUTPUT}" <<'NODE'
const fs = require("fs");
const [resultsPath, statusPath, outputPath] = process.argv.slice(2);
const env = process.env;

const WORKLOADS = [
  ["parse_g", "parse(G address)"],
  ["parse_m", "parse(M address)"],
  ["decode_muxed", "decodeMuxed(M address)"],
  ["extract_routing_memo_id", "extractRouting(G + MEMO_ID)"],
];
const RUNTIMES = [["ts", "TypeScript"], ["go", "Go"], ["dart", "Dart"]];

const results = {};
for (const line of fs.readFileSync(resultsPath, "utf8").split("\n").filter(Boolean)) {
  const [rt, wl, ops] = line.split("\t");
  (results[wl] ??= {})[rt] = Number(ops);
}
const status = Object.fromEntries(
  fs.readFileSync(statusPath, "utf8").split("\n").filter(Boolean)
    .map((l) => { const [rt, s, d] = l.split("\t"); return [rt, { s, d: d ?? "" }]; }),
);

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const cell = (s) => String(s).replace(/\|/g, "\\|");
const tick = "`";
const fence = "```";

const out = [
  "---",
  'title: "Cross-language Performance Parity"',
  'description: "ops/sec for the TypeScript, Go and Dart implementations on identical hardware"',
  "---",
  "",
  "{/* Generated by scripts/run-parity-benchmarks.sh. Do not edit by hand; re-run the script. */}",
  "",
  "Each workload uses the same inputs in every language and the runtimes run one after another on one host, so the numbers are directly comparable. Higher is better.",
  "",
  "## Environment",
  "",
  "| | |",
  "|---|---|",
  `| Date | ${new Date().toISOString().slice(0, 10)} |`,
  `| Commit | ${tick}${env.GIT_REV.split(" ")[0]}${tick}${env.GIT_REV.includes(" ") ? " " + env.GIT_REV.slice(env.GIT_REV.indexOf(" ") + 1) : ""} |`,
  `| CPU | ${cell(env.CPU_MODEL)} (${env.CPU_COUNT} logical cores) |`,
  `| OS | ${cell(env.OS_NAME)} |`,
  `| Time per workload | ${env.BENCH_TIME}s |`,
  `| CPU pinning | ${env.PIN_CPU ? `CPU ${env.PIN_CPU} (taskset)` : "none"} |`,
];
for (const [rt, label] of RUNTIMES) {
  const st = status[rt] ?? { s: "skipped", d: "" };
  out.push(`| ${label} | ${st.s === "ok" ? cell(st.d) : `**${st.s}**: ${cell(st.d)}`} |`);
}

out.push("", "## Results (ops/sec)", "");
out.push(`| Workload | ${RUNTIMES.map(([, l]) => l).join(" | ")} | Fastest |`);
out.push(`|---|${RUNTIMES.map(() => "---:").join("|")}|---|`);
for (const [wl, label] of WORKLOADS) {
  const row = results[wl] ?? {};
  const present = RUNTIMES.filter(([rt]) => row[rt] !== undefined);
  const best = present.length ? Math.max(...present.map(([rt]) => row[rt])) : 0;
  const fastest = present.find(([rt]) => row[rt] === best);
  const cells = RUNTIMES.map(([rt]) => {
    if (row[rt] === undefined) return "n/a";
    return row[rt] === best ? `**${fmt(row[rt])}**` : `${fmt(row[rt])} (${(row[rt] / best).toFixed(2)}x)`;
  });
  out.push(`| ${tick}${wl}${tick} ${label} | ${cells.join(" | ")} | ${fastest ? fastest[1] : "n/a"} |`);
}
out.push("", "Values in parentheses are relative to the fastest runtime for that workload. `n/a` means the runtime was skipped or failed; see Environment.", "");

out.push("## Charts", "");
for (const [wl, label] of WORKLOADS) {
  const row = results[wl] ?? {};
  const values = RUNTIMES.map(([rt]) => Math.round(row[rt] ?? 0));
  out.push(
    `### ${label}`,
    "",
    `${fence}mermaid`,
    "xychart-beta",
    `  title "${wl} (ops/sec, higher is better)"`,
    `  x-axis [${RUNTIMES.map(([, l]) => `"${l}"`).join(", ")}]`,
    `  y-axis "ops/sec" 0 --> ${Math.max(1, ...values)}`,
    `  bar [${values.join(", ")}]`,
    fence,
    "",
  );
}

out.push(
  "## Reproducing",
  "",
  `${fence}bash`,
  "pnpm install",
  "PIN_CPU=2 BENCH_TIME=2 scripts/run-parity-benchmarks.sh",
  fence,
  "",
  "Workload sources: `packages/core-ts/bench/parity.bench.ts`, `packages/core-go/{address,muxed,routing}/parity_bench_test.go` and `packages/core-dart/benchmark/parity_benchmark.dart`. Keep them in sync when adding a workload.",
);
fs.writeFileSync(outputPath, out.join("\n") + "\n");
NODE

log "wrote ${OUTPUT}"
cat "${STATUS}" | while IFS=$'\t' read -r rt st detail; do log "  ${rt}: ${st} ${detail}"; done
