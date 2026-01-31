#![deny(clippy::all)]
#![warn(clippy::pedantic)]

use napi_derive::napi;

#[napi(object)]
pub struct Options {
    /// Strip trailing commas in addition to comments.
    /// @default false
    pub trailing_commas: Option<bool>,

    /// Replace comments and trailing commas with whitespace instead of stripping them entirely.
    /// @default true
    pub whitespace: Option<bool>,
}

#[derive(PartialEq)]
enum CommentType {
    None,
    Single,
    Multi,
}

/// State machine for processing JSON with comments
struct JsonProcessor {
    bytes: Vec<u8>,
    len: usize,
    index: usize,
    offset: usize,
    is_inside_string: bool,
    is_inside_comment: CommentType,
    buffer: Vec<u8>,
    result: Vec<u8>,
    comma_index: Option<usize>,
    whitespace: bool,
    trailing_commas: bool,
}

impl JsonProcessor {
    /// Create a new processor with the given options
    fn new(input: String, whitespace: bool, trailing_commas: bool) -> Self {
        let bytes = input.into_bytes();
        let len = bytes.len();

        Self {
            bytes,
            len,
            index: 0,
            offset: 0,
            is_inside_string: false,
            is_inside_comment: CommentType::None,
            buffer: Vec::with_capacity(len),
            result: Vec::with_capacity(len),
            comma_index: None,
            whitespace,
            trailing_commas,
        }
    }

    /// Process the entire input and return the result
    fn process(mut self) -> String {
        while self.index < self.len {
            self.process_byte();
            self.index += 1;
        }

        self.finalize()
    }

    /// Process a single byte position
    fn process_byte(&mut self) {
        let current = self.bytes[self.index];
        let next = if self.index + 1 < self.len {
            Some(self.bytes[self.index + 1])
        } else {
            None
        };

        // Handle string boundaries
        if self.is_inside_comment == CommentType::None && current == b'"' && !self.is_escaped() {
            self.is_inside_string = !self.is_inside_string;
        }

        // Skip processing when inside a string
        if self.is_inside_string {
            return;
        }

        // Handle comment transitions
        if self.handle_comment_transition(current, next) {
            return;
        }

        // Handle trailing commas
        if self.trailing_commas && self.is_inside_comment == CommentType::None {
            self.handle_trailing_comma(current);
        }
    }

    /// Check if current position is an escaped quote
    #[inline]
    fn is_escaped(&self) -> bool {
        let mut backslash_count = 0;
        let mut idx = self.index;

        while idx > 0 {
            idx -= 1;
            if self.bytes[idx] == b'\\' {
                backslash_count += 1;
            } else {
                break;
            }
        }

        backslash_count % 2 == 1
    }

    /// Handle entering/exiting comments. Returns true if index was advanced.
    fn handle_comment_transition(&mut self, current: u8, next: Option<u8>) -> bool {
        if self.is_inside_comment == CommentType::None && current == b'/' && next == Some(b'/') {
            // Enter single-line comment
            self.flush_to_buffer(self.index);
            self.offset = self.index;
            self.is_inside_comment = CommentType::Single;
            self.index += 1; // Skip second '/'
            true
        } else if self.is_inside_comment == CommentType::Single
            && current == b'\r'
            && next == Some(b'\n')
        {
            // Exit single-line comment via \r\n
            self.index += 2;
            self.is_inside_comment = CommentType::None;
            self.strip_and_append_to_buffer(self.offset, self.index);
            self.offset = self.index;
            self.index -= 1; // Will be incremented by main loop
            true
        } else if self.is_inside_comment == CommentType::Single && current == b'\n' {
            // Exit single-line comment via \n
            self.is_inside_comment = CommentType::None;
            self.strip_and_append_to_buffer(self.offset, self.index);
            self.offset = self.index;
            true
        } else if self.is_inside_comment == CommentType::None
            && current == b'/'
            && next == Some(b'*')
        {
            // Enter multiline comment
            self.flush_to_buffer(self.index);
            self.offset = self.index;
            self.is_inside_comment = CommentType::Multi;
            self.index += 1; // Skip '*'
            true
        } else if self.is_inside_comment == CommentType::Multi
            && current == b'*'
            && next == Some(b'/')
        {
            // Exit multiline comment
            self.index += 2;
            self.is_inside_comment = CommentType::None;
            self.strip_and_append_to_buffer(self.offset, self.index);
            self.offset = self.index;
            self.index -= 1; // Will be incremented by main loop
            true
        } else {
            false
        }
    }

    /// Handle trailing comma detection and stripping
    fn handle_trailing_comma(&mut self, current: u8) {
        if self.comma_index.is_some() {
            if current == b'}' || current == b']' {
                // Strip trailing comma
                self.flush_to_buffer(self.index);
                // Strip the first byte (the comma) from buffer
                if !self.buffer.is_empty() {
                    if self.whitespace {
                        self.result.push(b' ');
                    }
                    self.result.extend_from_slice(&self.buffer[1..]);
                }
                self.buffer.clear();
                self.offset = self.index;
                self.comma_index = None;
            } else if !matches!(current, b' ' | b'\t' | b'\r' | b'\n') {
                // Hit non-whitespace after comma; comma is not trailing
                self.flush_to_buffer(self.index);
                self.offset = self.index;
                self.comma_index = None;
            }
        } else if current == b',' {
            // Flush buffer and record comma position
            self.result.append(&mut self.buffer);
            self.flush_to_result(self.index);
            self.buffer.clear();
            self.offset = self.index;
            self.comma_index = Some(self.index);
        }
    }

    /// Flush bytes from offset to end into buffer
    #[inline]
    fn flush_to_buffer(&mut self, end: usize) {
        if self.offset < end {
            self.buffer.extend_from_slice(&self.bytes[self.offset..end]);
        }
    }

    /// Flush bytes from offset to end into result
    #[inline]
    fn flush_to_result(&mut self, end: usize) {
        if self.offset < end {
            self.result.extend_from_slice(&self.bytes[self.offset..end]);
        }
    }

    /// Strip a range and append to buffer
    #[inline]
    fn strip_and_append_to_buffer(&mut self, start: usize, end: usize) {
        if self.whitespace {
            for &byte in &self.bytes[start..end] {
                self.buffer
                    .push(if matches!(byte, b' ' | b'\t' | b'\r' | b'\n') {
                        byte
                    } else {
                        b' '
                    });
            }
        }
        // If whitespace is false, append nothing (strip entirely)
    }

    /// Finalize processing and return the result
    fn finalize(mut self) -> String {
        if self.is_inside_comment == CommentType::Single {
            self.strip_and_append_to_buffer(self.offset, self.len);
        } else {
            self.flush_to_buffer(self.len);
        }

        self.result.append(&mut self.buffer);

        // SAFETY: We started with valid UTF-8 (String input) and only modified
        // ASCII characters (/, *, \r, \n, whitespace, commas, braces).
        // All operations preserve UTF-8 validity.
        unsafe { String::from_utf8_unchecked(self.result) }
    }
}

/// Strip comments from JSON. Lets you use comments in your JSON files!
///
/// It will replace single-line comments and multi-line comments with whitespace.
/// This allows JSON error positions to remain as close as possible to the original source.
///
/// # Example
///
///    const stripJsonComments = require('@native/strip-json-comments-rs');
///    const json = '{//rainbows//"unicorn":"cake"}';
///    JSON.parse(stripJsonComments(json));
///    //=> {unicorn: 'cake'}
///
/// # Errors
///
/// Returns Err if NAPI value conversion fails (should not occur in normal usage).
/// The function itself does not validate JSON syntax.
///
/// # NAPI Constraint
///
/// The function signature uses String instead of &str because NAPI-RS removed
/// &str `FromNapiValue` in v3.0.0-alpha.16. This is required for JS interop.
///
/// # Safety
///
/// Internally uses unsafe for the final UTF-8 conversion. This is safe because:
/// - Input is guaranteed valid UTF-8 (comes from JS String)
/// - We only modify ASCII bytes (comments, whitespace, commas)
/// - All UTF-8 multi-byte sequences are preserved unchanged
#[must_use]
#[allow(clippy::needless_pass_by_value)] // Required by NAPI-RS - cannot use &str
#[napi]
pub fn strip_json_comments(json_string: String, options: Option<Options>) -> String {
    let whitespace = options.as_ref().and_then(|o| o.whitespace).unwrap_or(true);
    let trailing_commas = options
        .as_ref()
        .and_then(|o| o.trailing_commas)
        .unwrap_or(false);

    let processor = JsonProcessor::new(json_string, whitespace, trailing_commas);

    processor.process()
}
