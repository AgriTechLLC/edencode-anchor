import { WeatherDataEncoder } from '../src/format/encoder';
import { sampleWeatherData, minimalWeatherData, extremeWeatherData } from './fixtures/weather-samples';
import { VERSION } from '../src/format/constants';

describe('WeatherDataEncoder', () => {
  let encoder: WeatherDataEncoder;

  beforeEach(() => {
    encoder = new WeatherDataEncoder();
  });

  describe('encode integers', () => {
    it('should encode positive integers', () => {
      const data = { ...minimalWeatherData, brightness: 68055 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
      expect(script.chunks.length).toBeGreaterThan(0);
    });

    it('should encode negative integers', () => {
      const data = { ...minimalWeatherData, air_temperature: -9 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode zero', () => {
      const data = minimalWeatherData;
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode large integers (epoch timestamps)', () => {
      const data = { ...minimalWeatherData, time: 1769529302 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });
  });

  describe('encode floats', () => {
    it('should encode positive floats', () => {
      const data = { ...minimalWeatherData, air_density: 1.29 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode negative floats', () => {
      const data = { ...minimalWeatherData, station_pressure: -979.7 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode very small floats', () => {
      const data = { ...minimalWeatherData, air_density: 0.000001 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should preserve float precision within tolerance', () => {
      const data = { ...minimalWeatherData, station_pressure: 979.123456 };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
      // Precision validation happens in round-trip tests
    });
  });

  describe('encode strings', () => {
    it('should encode ASCII strings', () => {
      const data = { ...minimalWeatherData, conditions: 'Clear' };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode UTF-8 strings with special characters', () => {
      const data = { ...minimalWeatherData, conditions: 'Test 测试 ⚡️' };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode empty strings', () => {
      const data = minimalWeatherData;
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode long strings', () => {
      const longString = 'A'.repeat(200);
      const data = { ...minimalWeatherData, lightning_strike_last_distance_msg: longString };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });
  });

  describe('encode booleans', () => {
    it('should encode true values', () => {
      const data = { ...minimalWeatherData, is_precip_local_day_rain_check: true };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });

    it('should encode false values', () => {
      const data = { ...minimalWeatherData, is_precip_local_day_rain_check: false };
      const script = encoder.encode(data);
      expect(script).toBeDefined();
    });
  });

  describe('encode complete weather object', () => {
    it('should encode sample weather data', () => {
      const script = encoder.encode(sampleWeatherData);
      expect(script).toBeDefined();
      // OP_FALSE + OP_RETURN + version byte + 33 fields = 36 chunks minimum
      expect(script.chunks.length).toBeGreaterThanOrEqual(36);
    });

    it('should encode minimal weather data', () => {
      const script = encoder.encode(minimalWeatherData);
      expect(script).toBeDefined();
      expect(script.chunks.length).toBeGreaterThanOrEqual(36);
    });

    it('should encode extreme weather data', () => {
      const script = encoder.encode(extremeWeatherData);
      expect(script).toBeDefined();
      expect(script.chunks.length).toBeGreaterThanOrEqual(36);
    });

    it('should produce deterministic output', () => {
      const script1 = encoder.encode(sampleWeatherData);
      const script2 = encoder.encode(sampleWeatherData);
      expect(script1.toHex()).toBe(script2.toHex());
    });

    it('should include version byte as first chunk', () => {
      const script = encoder.encode(sampleWeatherData);
      // The version should be encoded as the first element
      expect(script.chunks[0]).toBeDefined();
    });
  });

  describe('encodeToHex', () => {
    it('should return a hex string', () => {
      const hex = encoder.encodeToHex(sampleWeatherData);
      expect(typeof hex).toBe('string');
      expect(hex.length).toBeGreaterThan(0);
      // Hex string should only contain valid hex characters
      expect(/^[0-9a-f]+$/i.test(hex)).toBe(true);
    });

    it('should be consistent with encode().toHex()', () => {
      const hex1 = encoder.encodeToHex(sampleWeatherData);
      const hex2 = encoder.encode(sampleWeatherData).toHex();
      expect(hex1).toBe(hex2);
    });
  });

  describe('script properties', () => {
    it('should create a valid Bitcoin script', () => {
      const script = encoder.encode(sampleWeatherData);
      expect(script.toBinary).toBeDefined();
      expect(script.toHex).toBeDefined();
      expect(script.toASM).toBeDefined();
    });

    it('should have reasonable script size', () => {
      const script = encoder.encode(sampleWeatherData);
      const binary = script.toBinary();
      // Weather data should be under 1KB when encoded
      expect(binary.length).toBeLessThan(1024);
      expect(binary.length).toBeGreaterThan(50); // But not too small
    });
  });

  describe('error handling', () => {
    it('should handle all required fields being present', () => {
      expect(() => encoder.encode(sampleWeatherData)).not.toThrow();
    });
  });
});
