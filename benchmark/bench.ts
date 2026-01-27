/**
 * Performance Benchmarks: strip-json-comments Native vs JS
 *
 * Uses tinybench to compare performance across realistic workloads
 * Target: >= 1.5x speedup for native implementation
 */

import { Bench } from 'tinybench'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Original JS implementation
import jsStripJsonComments from 'strip-json-comments'

// Native Rust implementation
import { stripJsonComments as nativeStripJsonComments } from '../index.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load fixtures
const fixtures = {
  small: readFileSync(join(__dirname, 'fixtures/small.json'), 'utf-8'),
  medium: readFileSync(join(__dirname, 'fixtures/medium.json'), 'utf-8'),
  large: readFileSync(join(__dirname, 'fixtures/large.json'), 'utf-8'),
  complex: readFileSync(join(__dirname, 'fixtures/complex.json'), 'utf-8'),
  stress: readFileSync(join(__dirname, 'fixtures/stress.json'), 'utf-8'),
}

console.log('Fixture sizes:')
console.log(`  Small:   ${(fixtures.small.length / 1024).toFixed(2)} KB`)
console.log(`  Medium:  ${(fixtures.medium.length / 1024).toFixed(2)} KB`)
console.log(`  Large:   ${(fixtures.large.length / 1024).toFixed(2)} KB`)
console.log(`  Complex: ${(fixtures.complex.length / 1024).toFixed(2)} KB`)
console.log(`  Stress:  ${(fixtures.stress.length / 1024 / 1024).toFixed(2)} MB`)
console.log()

interface BenchResult {
  jsOps: string
  nativeOps: string
  speedup: string
  faster: string
}

const results: Record<string, BenchResult> = {}

async function runSuite(
  name: string,
  fixture: string,
  options: { whitespace?: boolean; trailingCommas?: boolean } = {},
) {
  console.log(`${name}`)

  // Verify functions work before benchmarking
  try {
    jsStripJsonComments(fixture, options)
  } catch (e) {
    console.log(`  ✗ JS implementation error: ${e}`)
    return
  }
  try {
    nativeStripJsonComments(fixture, options)
  } catch (e) {
    console.log(`  ✗ Native implementation error: ${e}`)
    return
  }

  const bench = new Bench({ time: 1000 })

  bench
    .add('JS (original)', () => {
      jsStripJsonComments(fixture, options)
    })
    .add('Native (Rust)', () => {
      nativeStripJsonComments(fixture, options)
    })

  await bench.run()

  const tasks = bench.tasks
  const jsTask = tasks.find((t) => t.name === 'JS (original)')!
  const nativeTask = tasks.find((t) => t.name === 'Native (Rust)')!

  if (!jsTask.result || !nativeTask.result) {
    console.log(`  ✗ Benchmark failed to complete`)
    return
  }

  const jsHz = jsTask.result.throughput.mean
  const nativeHz = nativeTask.result.throughput.mean

  console.log(`  JS (original): ${jsHz.toFixed(0)} ops/sec`)
  console.log(`  Native (Rust): ${nativeHz.toFixed(0)} ops/sec`)

  const speedup = nativeHz / jsHz
  const faster = speedup >= 1 ? 'Native' : 'JS'

  results[name] = {
    jsOps: jsHz.toFixed(0),
    nativeOps: nativeHz.toFixed(0),
    speedup: speedup.toFixed(2),
    faster,
  }

  console.log(`  → Fastest: ${faster}`)
  console.log(`  → Speedup: ${speedup.toFixed(2)}x ${speedup >= 1.0 ? '✓' : '✗'}`)
  console.log()
}

// Run benchmarks
console.log('Running benchmarks...\n')
console.log('═'.repeat(60))
console.log()

await runSuite('Small fixture (config file)', fixtures.small)
await runSuite('Medium fixture (tsconfig)', fixtures.medium)
await runSuite('Large fixture (package-lock)', fixtures.large)
await runSuite('Complex fixture (asymmetric nested)', fixtures.complex)
await runSuite('Stress test (3.2MB, dense comments)', fixtures.stress)

// Options variants
console.log('Testing with whitespace: false option...\n')
await runSuite('Small (whitespace: false)', fixtures.small, { whitespace: false })
await runSuite('Medium (whitespace: false)', fixtures.medium, { whitespace: false })

console.log('Testing with trailingCommas: true option...\n')
await runSuite('Small (trailingCommas)', fixtures.small, { trailingCommas: true })

// Summary
console.log('═'.repeat(60))
console.log('\nSUMMARY\n')
console.log('Benchmark                              | JS ops/s    | Native ops/s | Speedup | Winner')
console.log('-'.repeat(95))

for (const [name, result] of Object.entries(results)) {
  const nameCol = name.padEnd(38)
  const jsCol = result.jsOps.padStart(11)
  const nativeCol = result.nativeOps.padStart(12)
  const speedupCol = (result.speedup + 'x').padStart(7)
  const winnerCol = result.faster.padStart(6)
  console.log(`${nameCol} | ${jsCol} | ${nativeCol} | ${speedupCol} | ${winnerCol}`)
}

const speedups = Object.values(results).map((r) => parseFloat(r.speedup))
const avgSpeedup = (speedups.reduce((a, b) => a + b, 0) / speedups.length).toFixed(2)
const minSpeedup = Math.min(...speedups).toFixed(2)
const maxSpeedup = Math.max(...speedups).toFixed(2)

console.log('-'.repeat(95))
console.log(`Average speedup: ${avgSpeedup}x | Min: ${minSpeedup}x | Max: ${maxSpeedup}x`)
console.log()

if (parseFloat(avgSpeedup) >= 1.5) {
  console.log('✓ Target achieved: Average speedup >= 1.5x')
} else {
  console.log('✗ Target not met: Average speedup < 1.5x')
}
