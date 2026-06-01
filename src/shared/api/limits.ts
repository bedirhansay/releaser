/**
 * Shared payload bounds for write endpoints. Keeping these in one place stops
 * an unbounded `markdown`/text field from letting a client persist arbitrarily
 * large rows (storage-DoS) while staying generous enough for real release docs.
 */

/** ~500 KB — far above any realistic release document. */
export const MAX_MARKDOWN_LEN = 500_000;

/** Upper bound for free-text summary/title blobs stored verbatim. */
export const MAX_TEXT_LEN = 20_000;
