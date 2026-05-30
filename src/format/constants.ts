/**
 * Schema version for backward compatibility
 */
export const VERSION = 1;

/**
 * Scale factor for float encoding (6 decimal places)
 * Example: 1.29 * 1000000 = 1290000
 */
export const FLOAT_SCALE = 1_000_000;

/**
 * Epsilon for float comparison (1 millionth)
 */
export const FLOAT_EPSILON = 1e-6;
