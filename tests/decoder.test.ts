import { WeatherDataDecoder } from '../src/format/decoder';
import { WeatherDataEncoder } from '../src/format/encoder';
import { sampleWeatherData, minimalWeatherData, extremeWeatherData } from './fixtures/weather-samples';
import { Script, OP } from '@bsv/sdk';
import { VERSION } from '../src/format/constants';

describe('WeatherDataDecoder', () => {
  let decoder: WeatherDataDecoder;
  let encoder: WeatherDataEncoder;

  beforeEach(() => {
    decoder = new WeatherDataDecoder();
    encoder = new WeatherDataEncoder();
  });

  describe('decode integers', () => {
    it('should decode positive integers', () => {
      const original = { ...minimalWeatherData, brightness: 68055 };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.brightness).toBe(68055);
    });

    it('should decode negative integers', () => {
      const original = { ...minimalWeatherData, air_temperature: -9 };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.air_temperature).toBe(-9);
    });

    it('should decode zero', () => {
      const original = minimalWeatherData;
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.air_temperature).toBe(0);
    });

    it('should decode large integers (epoch timestamps)', () => {
      const original = { ...minimalWeatherData, time: 1769529302 };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.time).toBe(1769529302);
    });
  });

  describe('decode floats', () => {
    it('should decode floats within precision tolerance', () => {
      const original = { ...minimalWeatherData, air_density: 1.29, station_pressure: 979.7 };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.air_density).toBeCloseTo(1.29, 6);
      expect(decoded.station_pressure).toBeCloseTo(979.7, 6);
    });

    it('should decode negative floats', () => {
      const original = { ...minimalWeatherData, station_pressure: -979.7 };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.station_pressure).toBeCloseTo(-979.7, 6);
    });

    it('should decode zero floats', () => {
      const original = { ...minimalWeatherData, air_density: 0 };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.air_density).toBe(0);
    });
  });

  describe('decode strings', () => {
    it('should decode ASCII strings correctly', () => {
      const original = { ...minimalWeatherData, conditions: 'Clear' };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.conditions).toBe('Clear');
    });

    it('should decode UTF-8 strings with special characters', () => {
      const original = { ...minimalWeatherData, conditions: 'Test 测试 ⚡️' };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.conditions).toBe('Test 测试 ⚡️');
    });

    it('should decode empty strings', () => {
      const original = minimalWeatherData;
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.conditions).toBe('');
    });

    it('should decode long strings', () => {
      const longString = 'A'.repeat(200);
      const original = { ...minimalWeatherData, lightning_strike_last_distance_msg: longString };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.lightning_strike_last_distance_msg).toBe(longString);
    });
  });

  describe('decode booleans', () => {
    it('should decode true values', () => {
      const original = { ...minimalWeatherData, is_precip_local_day_rain_check: true };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.is_precip_local_day_rain_check).toBe(true);
    });

    it('should decode false values', () => {
      const original = { ...minimalWeatherData, is_precip_local_day_rain_check: false };
      const script = encoder.encode(original);
      const decoded = decoder.decode(script);
      expect(decoded.is_precip_local_day_rain_check).toBe(false);
    });
  });

  describe('decode complete weather objects', () => {
    it('should decode sample weather data', () => {
      const script = encoder.encode(sampleWeatherData);
      const decoded = decoder.decode(script);
      expect(decoded).toBeDefined();
      expect(decoded.time).toBe(sampleWeatherData.time);
      expect(decoded.conditions).toBe(sampleWeatherData.conditions);
    });

    it('should decode minimal weather data', () => {
      const script = encoder.encode(minimalWeatherData);
      const decoded = decoder.decode(script);
      expect(decoded).toBeDefined();
    });

    it('should decode extreme weather data', () => {
      const script = encoder.encode(extremeWeatherData);
      const decoded = decoder.decode(script);
      expect(decoded).toBeDefined();
      expect(decoded.conditions).toBe(extremeWeatherData.conditions);
    });
  });

  describe('version handling', () => {
    it('should accept current version', () => {
      const script = encoder.encode(sampleWeatherData);
      expect(() => decoder.decode(script)).not.toThrow();
    });

    it('should throw error for unsupported version', () => {
      // Create a script with wrong version
      const script = new Script();
      script.writeOpCode(OP.OP_FALSE);
      script.writeOpCode(OP.OP_RETURN);
      script.writeNumber(999); // Invalid version
      // Add dummy data to pass chunk count check
      for (let i = 0; i < 33; i++) {
        script.writeNumber(0);
      }
      expect(() => decoder.decode(script)).toThrow(/version/i);
    });
  });

  describe('decodeFromHex', () => {
    it('should decode from hex string', () => {
      const hex = encoder.encodeToHex(sampleWeatherData);
      const decoded = decoder.decodeFromHex(hex);
      expect(decoded.time).toBe(sampleWeatherData.time);
      expect(decoded.conditions).toBe(sampleWeatherData.conditions);
    });

    it('should be consistent with decode()', () => {
      const script = encoder.encode(sampleWeatherData);
      const decoded1 = decoder.decode(script);
      const decoded2 = decoder.decodeFromHex(script.toHex());
      expect(decoded1).toEqual(decoded2);
    });
  });

  describe('error handling', () => {
    it('should throw on malformed script (too few chunks)', () => {
      const script = new Script();
      script.writeOpCode(OP.OP_FALSE);
      script.writeOpCode(OP.OP_RETURN);
      script.writeNumber(VERSION);
      script.writeNumber(1); // Only 1 field instead of 33
      expect(() => decoder.decode(script)).toThrow(/malformed/i);
    });
  });
});
