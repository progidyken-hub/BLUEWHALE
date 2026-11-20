/**
 * Module-level regular expressions shared by the parsing and classification
 * hot paths.
 *
 * Every pattern is compiled once when the module loads. A regex literal
 * inside a function body produces a fresh `RegExp` object every time that
 * line runs. In loops such as `labels.every(...)` or per-address
 * classification, that is a needless allocation on every iteration.
 *
 * Flag rules (do not break these when adding patterns):
 *
 * - Patterns used with `.test()` / `.exec()` MUST NOT carry the `g` or `y`
 *   flag. A global/sticky regex keeps `lastIndex` between calls. With a
 *   shared constant, a second `.test()` on the same input starts at the old
 *   `lastIndex` and returns `false`, so validation becomes order-dependent.
 * - Patterns with `g` are only for `String.prototype.replace` /
 *   `replaceAll`. Those calls reset `lastIndex` to 0 before they run and
 *   leave it there, so sharing them is safe. Their names end in `_G` to
 *   make the restriction visible at the call site.
 *
 * `src/patterns.test.ts` enforces both rules.
 *
 * @internal Not re-exported from the package entry point.
 */

/** One or more ASCII decimal digits and nothing else (uint64 routing IDs). */
export const DIGITS_ONLY = /^\d+$/;

/** Leading zeros of a decimal string, for canonicalisation. */
export const LEADING_ZEROS = /^0+/;

/** A single trailing slash, stripped from base URLs before joining paths. */
export const TRAILING_SLASH = /\/$/;

/** One DNS label per RFC 1035 / RFC 1123: alnum at both ends, hyphens inside, max 63. */
export const RFC1035_LABEL = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/** ANSI CSI escape sequences (colours, cursor movement). `replace` only. */
export const ANSI_ESCAPE_G = /\x1b\[[0-9;]*[a-zA-Z]/g;

/** C0/C1 control characters except TAB (0x09) and LF (0x0A). `replace` only. */
export const CONTROL_CHARS_G = /[\x00-\x08\x0B-\x1F\x7F-\x9F]/g;
