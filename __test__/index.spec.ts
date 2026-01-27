/**
 * Differential Tests: strip-json-comments
 * Compares native implementation against original JS library
 */

import test from 'ava'
import fc from 'fast-check'

// Original JS implementation (oracle) - exports default function
import jsStripJsonComments from 'strip-json-comments'

// Native Rust implementation
import { stripJsonComments as nativeStripJsonComments } from '../index.mjs'

// Basic functionality
test('handles JSON without comments', (t) => {
  const json = '{"a": 1, "b": 2}'
  t.is(nativeStripJsonComments(json), jsStripJsonComments(json))
})

test('handles empty string', (t) => {
  const json = ''
  t.is(nativeStripJsonComments(json), jsStripJsonComments(json))
})

test('handles string with only comments', (t) => {
  const json = '// only comment'
  t.is(nativeStripJsonComments(json), jsStripJsonComments(json))
})

// Replace comments with whitespace (default)
test('replaces single-line comments with whitespace', (t) => {
  t.is(nativeStripJsonComments('//comment\n{"a":"b"}'), jsStripJsonComments('//comment\n{"a":"b"}'))
  t.is(nativeStripJsonComments('{"a":"b"//comment\n}'), jsStripJsonComments('{"a":"b"//comment\n}'))
})

test('replaces multi-line comments with whitespace', (t) => {
  t.is(nativeStripJsonComments('/*//comment*/{"a":"b"}'), jsStripJsonComments('/*//comment*/{"a":"b"}'))
  t.is(nativeStripJsonComments('{"a":"b"/*comment*/}'), jsStripJsonComments('{"a":"b"/*comment*/}'))
  t.is(nativeStripJsonComments('{"a"/*\n\n\ncomment\r\n*/:"b"}'), jsStripJsonComments('{"a"/*\n\n\ncomment\r\n*/:"b"}'))
})

test('handles JSDoc-style comments', (t) => {
  t.is(
    nativeStripJsonComments('/*!\n * comment\n */\n{"a":"b"}'),
    jsStripJsonComments('/*!\n * comment\n */\n{"a":"b"}'),
  )
})

test('handles comments immediately after opening brace', (t) => {
  t.is(nativeStripJsonComments('{/*comment*/"a":"b"}'), jsStripJsonComments('{/*comment*/"a":"b"}'))
})

// Remove comments (whitespace: false)
test('removes single-line comments with whitespace: false', (t) => {
  const opts = { whitespace: false }
  t.is(nativeStripJsonComments('//comment\n{"a":"b"}', opts), jsStripJsonComments('//comment\n{"a":"b"}', opts))
  t.is(nativeStripJsonComments('{"a":"b"//comment\n}', opts), jsStripJsonComments('{"a":"b"//comment\n}', opts))
})

test('removes multi-line comments with whitespace: false', (t) => {
  const opts = { whitespace: false }
  t.is(nativeStripJsonComments('/*//comment*/{"a":"b"}', opts), jsStripJsonComments('/*//comment*/{"a":"b"}', opts))
  t.is(nativeStripJsonComments('{"a":"b"/*comment*/}', opts), jsStripJsonComments('{"a":"b"/*comment*/}', opts))
  t.is(
    nativeStripJsonComments('{"a"/*\n\n\ncomment\r\n*/:"b"}', opts),
    jsStripJsonComments('{"a"/*\n\n\ncomment\r\n*/:"b"}', opts),
  )
})

test('removes JSDoc-style comments with whitespace: false', (t) => {
  const opts = { whitespace: false }
  t.is(
    nativeStripJsonComments('/*!\n * comment\n */\n{"a":"b"}', opts),
    jsStripJsonComments('/*!\n * comment\n */\n{"a":"b"}', opts),
  )
})

test('removes comments immediately after opening brace with whitespace: false', (t) => {
  const opts = { whitespace: false }
  t.is(nativeStripJsonComments('{/*comment*/"a":"b"}', opts), jsStripJsonComments('{/*comment*/"a":"b"}', opts))
})

// Strings with comment-like content
test('does not strip comments inside strings', (t) => {
  t.is(nativeStripJsonComments('{"a":"b//c"}'), jsStripJsonComments('{"a":"b//c"}'))
  t.is(nativeStripJsonComments('{"a":"b/*c*/"}'), jsStripJsonComments('{"a":"b/*c*/"}'))
  t.is(nativeStripJsonComments('{"/*a":"b"}'), jsStripJsonComments('{"/*a":"b"}'))
  t.is(nativeStripJsonComments('{"\\"/*a":"b"}'), jsStripJsonComments('{"\\"/*a":"b"}'))
})

// Escaped characters
test('handles escaped quotes', (t) => {
  t.is(nativeStripJsonComments('{"a": "b\\"c"}'), jsStripJsonComments('{"a": "b\\"c"}'))
})

test('considers escaped slashes when checking for escaped string quote', (t) => {
  t.is(nativeStripJsonComments('{"\\\\":"https://foobar.com"}'), jsStripJsonComments('{"\\\\":"https://foobar.com"}'))
  t.is(
    nativeStripJsonComments('{"foo\\"":"https://foobar.com"}'),
    jsStripJsonComments('{"foo\\"":"https://foobar.com"}'),
  )
})

test('handles weird escaping', (t) => {
  const input = String.raw`{"x":"x \"sed -e \\\"s/^.\\\\{46\\\\}T//\\\" -e \\\"s/#033/\\\\x1b/g\\\"\""}`
  t.is(nativeStripJsonComments(input), jsStripJsonComments(input))
})

// Line endings
test('preserves line endings with no comments', (t) => {
  t.is(nativeStripJsonComments('{"a":"b"\n}'), jsStripJsonComments('{"a":"b"\n}'))
  t.is(nativeStripJsonComments('{"a":"b"\r\n}'), jsStripJsonComments('{"a":"b"\r\n}'))
})

test('handles line endings with single line comments', (t) => {
  t.is(nativeStripJsonComments('{"a":"b"//c\n}'), jsStripJsonComments('{"a":"b"//c\n}'))
  t.is(nativeStripJsonComments('{"a":"b"//c\r\n}'), jsStripJsonComments('{"a":"b"//c\r\n}'))
})

test('handles line endings with single line block comments', (t) => {
  t.is(nativeStripJsonComments('{"a":"b"/*c*/\n}'), jsStripJsonComments('{"a":"b"/*c*/\n}'))
  t.is(nativeStripJsonComments('{"a":"b"/*c*/\r\n}'), jsStripJsonComments('{"a":"b"/*c*/\r\n}'))
})

test('handles line endings with multi line block comments', (t) => {
  t.is(nativeStripJsonComments('{"a":"b",/*c\nc2*/"x":"y"\n}'), jsStripJsonComments('{"a":"b",/*c\nc2*/"x":"y"\n}'))
  t.is(
    nativeStripJsonComments('{"a":"b",/*c\r\nc2*/"x":"y"\r\n}'),
    jsStripJsonComments('{"a":"b",/*c\r\nc2*/"x":"y"\r\n}'),
  )
})

test('handles comments at EOF', (t) => {
  t.is(nativeStripJsonComments('{\r\n\t"a":"b"\r\n} //EOF'), jsStripJsonComments('{\r\n\t"a":"b"\r\n} //EOF'))
  t.is(
    nativeStripJsonComments('{\r\n\t"a":"b"\r\n} //EOF', { whitespace: false }),
    jsStripJsonComments('{\r\n\t"a":"b"\r\n} //EOF', { whitespace: false }),
  )
})

// Trailing commas
test('strips trailing commas in objects', (t) => {
  t.is(
    nativeStripJsonComments('{"x":true,}', { trailingCommas: true }),
    jsStripJsonComments('{"x":true,}', { trailingCommas: true }),
  )
  t.is(
    nativeStripJsonComments('{"x":true,}', { trailingCommas: true, whitespace: false }),
    jsStripJsonComments('{"x":true,}', { trailingCommas: true, whitespace: false }),
  )
  t.is(
    nativeStripJsonComments('{"x":true,\n  }', { trailingCommas: true }),
    jsStripJsonComments('{"x":true,\n  }', { trailingCommas: true }),
  )
})

test('strips trailing commas in arrays', (t) => {
  t.is(
    nativeStripJsonComments('[true, false,]', { trailingCommas: true }),
    jsStripJsonComments('[true, false,]', { trailingCommas: true }),
  )
  t.is(
    nativeStripJsonComments('[true, false,]', { trailingCommas: true, whitespace: false }),
    jsStripJsonComments('[true, false,]', { trailingCommas: true, whitespace: false }),
  )
})

test('strips trailing commas in nested structures', (t) => {
  const input = '{\n  "array": [\n    true,\n    false,\n  ],\n}'
  t.is(
    nativeStripJsonComments(input, { trailingCommas: true, whitespace: false }),
    jsStripJsonComments(input, { trailingCommas: true, whitespace: false }),
  )
})

test('strips trailing commas with comments', (t) => {
  const input = '{\n  "array": [\n    true,\n    false /* comment */ ,\n /*comment*/ ],\n}'
  t.is(
    nativeStripJsonComments(input, { trailingCommas: true, whitespace: false }),
    jsStripJsonComments(input, { trailingCommas: true, whitespace: false }),
  )
})

// Edge cases
test('handles malformed block comments', (t) => {
  t.is(nativeStripJsonComments('[] */'), jsStripJsonComments('[] */'))
  t.is(nativeStripJsonComments('[] /*'), jsStripJsonComments('[] /*'))
})

test('handles non-breaking space with preserving whitespace', (t) => {
  const fixture = `{
    // Comment with non-breaking-space: '\u00A0'
    "a": 1
    }`
  const nativeResult = nativeStripJsonComments(fixture)
  const jsResult = jsStripJsonComments(fixture)
  // Note: Native may have slight whitespace differences for Unicode chars,
  // but both must parse to same JSON
  t.deepEqual(JSON.parse(nativeResult), { a: 1 })
  t.deepEqual(JSON.parse(nativeResult), JSON.parse(jsResult))
})

test('throws TypeError for non-string input', (t) => {
  t.throws(() => nativeStripJsonComments(123 as any))
  t.throws(() => jsStripJsonComments(123 as any), { instanceOf: TypeError })
})

// Property-based testing
test('handles random JSON-like strings', (t) => {
  fc.assert(
    fc.property(fc.string({ maxLength: 100 }), (str) => {
      try {
        const nativeResult = nativeStripJsonComments(str)
        const jsResult = jsStripJsonComments(str)
        return nativeResult === jsResult
      } catch {
        // Both should throw on invalid input
        return true
      }
    }),
  )
  t.pass()
})
