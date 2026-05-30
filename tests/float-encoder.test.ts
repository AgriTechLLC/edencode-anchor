import { encodeFloat, decodeFloat, validateFloatPrecision } from '../src/utils/float-encoder';
import { FLOAT_SCALE, FLOAT_EPSILON } from '../src/format/constants';

describe('Float Encoder', () => {
  describe('encodeFloat', () => {
    it('should encode positive floats correctly', () => {
      expect(encodeFloat(1.29, FLOAT_SCALE)).toBe(1290000);
      expect(encodeFloat(979.7, FLOAT_SCALE)).toBe(979700000);
      expect(encodeFloat(0.5, FLOAT_SCALE)).toBe(500000);
    });

    it('should encode negative floats correctly', () => {
      expect(encodeFloat(-1.29, FLOAT_SCALE)).toBe(-1290000);
      expect(encodeFloat(-979.7, FLOAT_SCALE)).toBe(-979700000);
    });

    it('should encode zero correctly', () => {
      expect(encodeFloat(0, FLOAT_SCALE)).toBe(0);
      expect(encodeFloat(0.0, FLOAT_SCALE)).toBe(0);
    });

    it('should encode very small floats', () => {
      expect(encodeFloat(0.000001, FLOAT_SCALE)).toBe(1);
      expect(encodeFloat(0.0000005, FLOAT_SCALE)).toBe(1); // rounds to 1
    });

    it('should encode very large floats', () => {
      expect(encodeFloat(12345.678901, FLOAT_SCALE)).toBe(12345678901);
    });

    it('should round properly during encoding', () => {
      // Test rounding behavior
      expect(encodeFloat(1.2345674, FLOAT_SCALE)).toBe(1234567); // rounds down
      expect(encodeFloat(1.2345675, FLOAT_SCALE)).toBe(1234568); // rounds up
    });
  });

  describe('decodeFloat', () => {
    it('should decode positive integers back to floats', () => {
      expect(decodeFloat(1290000, FLOAT_SCALE)).toBe(1.29);
      expect(decodeFloat(979700000, FLOAT_SCALE)).toBe(979.7);
      expect(decodeFloat(500000, FLOAT_SCALE)).toBe(0.5);
    });

    it('should decode negative integers back to floats', () => {
      expect(decodeFloat(-1290000, FLOAT_SCALE)).toBe(-1.29);
      expect(decodeFloat(-979700000, FLOAT_SCALE)).toBe(-979.7);
    });

    it('should decode zero correctly', () => {
      expect(decodeFloat(0, FLOAT_SCALE)).toBe(0);
    });

    it('should decode very small values', () => {
      expect(decodeFloat(1, FLOAT_SCALE)).toBe(0.000001);
    });

    it('should decode very large values', () => {
      expect(decodeFloat(12345678901, FLOAT_SCALE)).toBe(12345.678901);
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should preserve original values through round-trip', () => {
      const testValues = [1.29, 979.7, 0.5, -1.29, 0, 123.456789];

      testValues.forEach(original => {
        const encoded = encodeFloat(original, FLOAT_SCALE);
        const decoded = decodeFloat(encoded, FLOAT_SCALE);
        expect(decoded).toBeCloseTo(original, 6);
      });
    });

    it('should handle precision limits correctly', () => {
      // Values with more than 6 decimal places will lose precision
      const original = 1.123456789; // 9 decimal places
      const encoded = encodeFloat(original, FLOAT_SCALE);
      const decoded = decodeFloat(encoded, FLOAT_SCALE);

      // Should be close but not exact due to rounding
      expect(decoded).toBeCloseTo(original, 6);
      expect(decoded).not.toBe(original); // Precision loss expected
    });
  });

  describe('validateFloatPrecision', () => {
    it('should return true for values within epsilon', () => {
      expect(validateFloatPrecision(1.29, 1.29, FLOAT_EPSILON)).toBe(true);
      expect(validateFloatPrecision(1.29, 1.2900001, FLOAT_EPSILON)).toBe(true);
      expect(validateFloatPrecision(1.29, 1.2899999, FLOAT_EPSILON)).toBe(true);
    });

    it('should return false for values outside epsilon', () => {
      expect(validateFloatPrecision(1.29, 1.30, FLOAT_EPSILON)).toBe(false);
      expect(validateFloatPrecision(1.29, 1.28, FLOAT_EPSILON)).toBe(false);
    });

    it('should work with negative values', () => {
      expect(validateFloatPrecision(-1.29, -1.29, FLOAT_EPSILON)).toBe(true);
      expect(validateFloatPrecision(-1.29, -1.2900001, FLOAT_EPSILON)).toBe(true);
      expect(validateFloatPrecision(-1.29, -1.30, FLOAT_EPSILON)).toBe(false);
    });

    it('should work with zero', () => {
      expect(validateFloatPrecision(0, 0, FLOAT_EPSILON)).toBe(true);
      expect(validateFloatPrecision(0, 0.0000001, FLOAT_EPSILON)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very small scale factors', () => {
      const smallScale = 100; // 2 decimal places
      expect(encodeFloat(1.23, smallScale)).toBe(123);
      expect(decodeFloat(123, smallScale)).toBe(1.23);
    });

    it('should handle very large scale factors', () => {
      const largeScale = 1_000_000_000; // 9 decimal places
      expect(encodeFloat(1.123456789, largeScale)).toBe(1123456789);
      expect(decodeFloat(1123456789, largeScale)).toBe(1.123456789);
    });

    it('should handle weather-specific values', () => {
      // Test actual weather data values
      const airDensity = 1.29;
      const stationPressure = 979.7;

      const encoded1 = encodeFloat(airDensity, FLOAT_SCALE);
      const encoded2 = encodeFloat(stationPressure, FLOAT_SCALE);

      expect(decodeFloat(encoded1, FLOAT_SCALE)).toBe(airDensity);
      expect(decodeFloat(encoded2, FLOAT_SCALE)).toBe(stationPressure);
    });
  });
});
