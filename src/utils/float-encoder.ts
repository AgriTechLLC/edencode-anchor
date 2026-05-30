/**
 * Encodes a floating-point number as a scaled integer for Bitcoin Script encoding.
 * Bitcoin Script does not support floating-point numbers, so we use fixed-point arithmetic.
 *
 * @param value - The floating-point number to encode
 * @param scale - The scale factor (e.g., 1000000 for 6 decimal places)
 * @returns The scaled integer representation
 *
 * @example
 * encodeFloat(1.29, 1000000) // returns 1290000
 * encodeFloat(979.7, 1000000) // returns 979700000
 */
export function encodeFloat(value: number, scale: number): number {
  return Math.round(value * scale);
}

/**
 * Decodes a scaled integer back to a floating-point number.
 *
 * @param scaled - The scaled integer value
 * @param scale - The scale factor used during encoding
 * @returns The original floating-point number
 *
 * @example
 * decodeFloat(1290000, 1000000) // returns 1.29
 * decodeFloat(979700000, 1000000) // returns 979.7
 */
export function decodeFloat(scaled: number, scale: number): number {
  return scaled / scale;
}

/**
 * Validates that a decoded float matches the original value within an epsilon tolerance.
 * Useful for testing round-trip encoding/decoding.
 *
 * @param original - The original floating-point number
 * @param decoded - The decoded floating-point number
 * @param epsilon - The maximum allowed difference (default: 1e-6)
 * @returns true if the values match within epsilon, false otherwise
 *
 * @example
 * validateFloatPrecision(1.29, 1.2900001, 1e-6) // returns true
 * validateFloatPrecision(1.29, 1.30, 1e-6) // returns false
 */
export function validateFloatPrecision(
  original: number,
  decoded: number,
  epsilon: number = 1e-6
): boolean {
  return Math.abs(original - decoded) < epsilon;
}
