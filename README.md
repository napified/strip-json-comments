# @napified/strip-json-comments

**~4x faster native Rust implementation of [strip-json-comments](https://github.com/sindresorhus/strip-json-comments)**

[![npm version](https://img.shields.io/npm/v/@napified/strip-json-comments.svg)](https://www.npmjs.com/package/@napified/strip-json-comments)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why Native?

The native Rust implementation provides significant performance improvements for:

- **Processing large config files** - 3-4x faster for typical configs
- **Build tools** that process many JSON files - amortizes overhead across batches
- **Hot paths** where parsing overhead matters - 5x+ speedup for multi-megabyte files

Perfect for CLI tools, bundlers, and any high-throughput JSON processing.

## Installation

```bash
npm install @napified/strip-json-comments@beta
```

## Usage

Drop-in replacement for `strip-json-comments`:

```javascript
const { stripJsonComments } = require('@napified/strip-json-comments');
// OR with ESM
import { stripJsonComments } from '@napified/strip-json-comments';

const json = stripJsonComments('{"foo": "bar" /* comment */}');
//=> '{"foo": "bar"                }'

JSON.parse(stripJsonComments('{/*rainbows*/"unicorn":"cake"}'));
//=> {unicorn: 'cake'}
```

## API

### stripJsonComments(jsonString, options?)

#### jsonString

Type: `string`

JSON string with comments to strip.

#### options

Type: `object`

##### whitespace

Type: `boolean`
Default: `true`

Replace comments with whitespace to preserve original character positions. Useful for preserving JSON error positions.

```javascript
stripJsonComments('{"a": 1 /* comment */}');
//=> '{"a": 1               }'

stripJsonComments('{"a": 1 /* comment */}', { whitespace: false });
//=> '{"a": 1 }'
```

##### trailingCommas

Type: `boolean`
Default: `false`

Strip trailing commas in objects and arrays.

```javascript
stripJsonComments('{"a": 1,}', { trailingCommas: true });
//=> '{"a": 1 }'
```

## Migration Guide

This is a **drop-in replacement** for `strip-json-comments`. Just change your import/require:

```diff
- const stripJsonComments = require('strip-json-comments');
+ const { stripJsonComments } = require('@napified/strip-json-comments');
```

Or use named import for better tree-shaking:

```diff
- import stripJsonComments from 'strip-json-comments';
+ import { stripJsonComments } from '@napified/strip-json-comments';
```

## Performance

Benchmarked on Apple M1 Pro, Node.js v22:

| Input Size | Description | JS ops/sec | Native ops/sec | Speedup |
|------------|-------------|------------|----------------|---------|
| 0.28 KB    | Config file | 164,011    | 608,696        | **3.71x** |
| 1.45 KB    | tsconfig.json | 38,824   | 169,948        | **4.38x** |
| 93.79 KB   | package-lock | 773        | 3,060          | **3.96x** |
| 111.83 KB  | Complex nested | 541      | 1,446          | **2.67x** |
| 3.31 MB    | Stress test | 13         | 71             | **5.64x** |

**Average speedup: 3.80x** (min: 2.67x, max: 5.64x)

### Why is it faster?

1. **Zero-copy string slicing** - Rust avoids allocations JavaScript must make
2. **Direct byte access** - No JS string encoding overhead
3. **Better memory layout** - Contiguous buffers vs fragmented JS objects
4. **No GC pauses** - Deterministic deallocation
5. **LLVM optimizations** - Auto-vectorization in hot loops

Performance scales with input size - larger files see bigger gains.

## Platform Support

Pre-built binaries available for:

- **macOS**: x64, ARM64 (Apple Silicon)
- **Linux**: x64
- **Windows**: x64

Automatically selected based on your platform during install.

## Implementation Details

- Built with [NAPI-RS](https://napi.rs/) for seamless Node.js integration
- Core logic in safe Rust (single justified `unsafe` block for UTF-8 validation)
- Zero-copy processing where possible
- Comprehensive test suite with differential tests ensuring behavioral equivalence

## Credits

Original JavaScript implementation by [Sindre Sorhus](https://github.com/sindresorhus).

This native port maintains 100% API compatibility while providing performance improvements through Rust.

## License

MIT

## See Also

- [strip-json-comments](https://github.com/sindresorhus/strip-json-comments) - Original JavaScript implementation
- [NAPI-RS](https://napi.rs/) - Rust bindings for Node.js native addons
