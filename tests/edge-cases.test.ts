import { WeatherDataEncoder } from '../src/format/encoder';
import { WeatherDataDecoder } from '../src/format/decoder';
import { minimalWeatherData } from './fixtures/weather-samples';
import { Script, OP } from '@bsv/sdk';
import { VERSION } from '../src/format/constants';

describe('Edge Cases', () => {
  let encoder: WeatherDataEncoder;
  let decoder: WeatherDataDecoder;

  beforeEach(() => {
    encoder = new WeatherDataEncoder();
    decoder = new WeatherDataDecoder();
  });

  describe('empty strings', () => {
    it('should handle empty strings correctly', () => {
      const data = {
        ...minimalWeatherData,
        conditions: '',
        icon: '',
        pressure_trend: '',
        wind_direction_cardinal: '',
        lightning_strike_last_distance_msg: '',
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.conditions).toBe('');
      expect(decoded.icon).toBe('');
      expect(decoded.pressure_trend).toBe('');
      expect(decoded.wind_direction_cardinal).toBe('');
      expect(decoded.lightning_strike_last_distance_msg).toBe('');
    });
  });

  describe('very long strings', () => {
    it('should handle strings longer than 75 bytes', () => {
      const longString = 'A'.repeat(100);
      const data = { ...minimalWeatherData, lightning_strike_last_distance_msg: longString };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.lightning_strike_last_distance_msg).toBe(longString);
    });

    it('should handle strings longer than 255 bytes', () => {
      const veryLongString = 'B'.repeat(300);
      const data = { ...minimalWeatherData, lightning_strike_last_distance_msg: veryLongString };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.lightning_strike_last_distance_msg).toBe(veryLongString);
    });

    it('should handle UTF-8 strings with multi-byte characters', () => {
      // Chinese characters are 3 bytes each in UTF-8
      const utf8String = '测试'.repeat(50); // 100 characters, ~300 bytes
      const data = { ...minimalWeatherData, conditions: utf8String };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.conditions).toBe(utf8String);
    });

    it('should test script size limits with very long content', () => {
      const maxString = 'X'.repeat(500);
      const data = { ...minimalWeatherData, lightning_strike_last_distance_msg: maxString };

      const encoded = encoder.encode(data);
      const binary = encoded.toBinary();

      // Should create valid script even with large data
      expect(binary.length).toBeGreaterThan(500);
      expect(binary.length).toBeLessThan(10000); // Reasonable upper limit

      const decoded = decoder.decode(encoded);
      expect(decoded.lightning_strike_last_distance_msg).toBe(maxString);
    });
  });

  describe('extreme float values', () => {
    it('should handle very large float values', () => {
      const data = {
        ...minimalWeatherData,
        air_density: 9999.999999,
        station_pressure: 99999.999999,
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.air_density).toBeCloseTo(9999.999999, 6);
      expect(decoded.station_pressure).toBeCloseTo(99999.999999, 6);
    });

    it('should handle very small float values', () => {
      const data = {
        ...minimalWeatherData,
        air_density: 0.000001,
        station_pressure: 0.000001,
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.air_density).toBeCloseTo(0.000001, 6);
      expect(decoded.station_pressure).toBeCloseTo(0.000001, 6);
    });

    it('should handle negative float values', () => {
      const data = {
        ...minimalWeatherData,
        air_density: -123.456789,
        station_pressure: -987.654321,
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.air_density).toBeCloseTo(-123.456789, 6);
      expect(decoded.station_pressure).toBeCloseTo(-987.654321, 6);
    });

    it('should handle float zero', () => {
      const data = {
        ...minimalWeatherData,
        air_density: 0.0,
        station_pressure: 0.0,
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.air_density).toBe(0);
      expect(decoded.station_pressure).toBe(0);
    });
  });

  describe('maximum safe integer', () => {
    it('should handle large positive integers', () => {
      const largeInt = 2147483647; // Max 32-bit signed integer
      const data = { ...minimalWeatherData, time: largeInt };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.time).toBe(largeInt);
    });

    it('should handle large negative integers', () => {
      const largeNegInt = -2147483647;
      const data = { ...minimalWeatherData, air_temperature: largeNegInt };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.air_temperature).toBe(largeNegInt);
    });

    it('should handle very large integers beyond 32-bit', () => {
      // Bitcoin Script supports arbitrary-length integers
      const veryLargeInt = 9007199254740991; // Number.MAX_SAFE_INTEGER
      const data = { ...minimalWeatherData, time: veryLargeInt };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.time).toBe(veryLargeInt);
    });
  });

  describe('special integer values', () => {
    it('should handle small positive integers (OP_1 through OP_16)', () => {
      for (let i = 0; i <= 16; i++) {
        const data = { ...minimalWeatherData, uv: i };
        const encoded = encoder.encode(data);
        const decoded = decoder.decode(encoded);
        expect(decoded.uv).toBe(i);
      }
    });

    it('should handle -1 (OP_1NEGATE)', () => {
      const data = { ...minimalWeatherData, air_temperature: -1 };
      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);
      expect(decoded.air_temperature).toBe(-1);
    });

    it('should handle 17 (first value after OP_16)', () => {
      const data = { ...minimalWeatherData, brightness: 17 };
      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);
      expect(decoded.brightness).toBe(17);
    });
  });

  describe('malformed scripts', () => {
    it('should throw on script with wrong version', () => {
      const script = new Script();
      script.writeOpCode(OP.OP_FALSE);
      script.writeOpCode(OP.OP_RETURN);
      script.writeNumber(999); // Wrong version
      // Add some dummy data
      for (let i = 0; i < 33; i++) {
        script.writeNumber(0);
      }

      expect(() => decoder.decode(script)).toThrow(/version/i);
    });

    it('should throw on script with too few chunks', () => {
      const script = new Script();
      script.writeOpCode(OP.OP_FALSE);
      script.writeOpCode(OP.OP_RETURN);
      script.writeNumber(VERSION);
      script.writeNumber(1);
      script.writeNumber(2);
      // Only 5 chunks total, need 36

      expect(() => decoder.decode(script)).toThrow(/malformed/i);
    });

    it('should handle scripts with extra chunks gracefully', () => {
      const data = minimalWeatherData;
      const script = encoder.encode(data);

      // Add extra data at the end
      script.writeNumber(999);
      script.writeNumber(888);

      // Should still decode correctly (ignores extra chunks)
      const decoded = decoder.decode(script);
      expect(decoded.time).toBe(data.time);
    });
  });

  describe('unicode and special characters', () => {
    it('should handle emoji in strings', () => {
      const data = {
        ...minimalWeatherData,
        icon: '⚡️☀️🌧️❄️',
        conditions: 'Thunderstorm ⛈️',
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.icon).toBe('⚡️☀️🌧️❄️');
      expect(decoded.conditions).toBe('Thunderstorm ⛈️');
    });

    it('should handle mixed language characters', () => {
      const data = {
        ...minimalWeatherData,
        conditions: 'Clear 晴天 晴れ Солнечно',
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.conditions).toBe('Clear 晴天 晴れ Солнечно');
    });

    it('should handle special punctuation and symbols', () => {
      const data = {
        ...minimalWeatherData,
        lightning_strike_last_distance_msg: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~',
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.lightning_strike_last_distance_msg).toBe('!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~');
    });
  });

  describe('script properties', () => {
    it('should create valid ASM representation', () => {
      const encoded = encoder.encode(minimalWeatherData);
      const asm = encoded.toASM();

      expect(typeof asm).toBe('string');
      expect(asm.length).toBeGreaterThan(0);
    });

    it('should create valid binary representation', () => {
      const encoded = encoder.encode(minimalWeatherData);
      const binary = encoded.toBinary();

      // toBinary() returns an array-like structure
      expect(binary).toBeDefined();
      expect(binary.length).toBeGreaterThan(0);
    });

    it('should create valid hex representation', () => {
      const encoded = encoder.encode(minimalWeatherData);
      const hex = encoded.toHex();

      expect(typeof hex).toBe('string');
      expect(/^[0-9a-f]+$/i.test(hex)).toBe(true);
    });
  });

  describe('boundary values', () => {
    it('should handle all zeros', () => {
      const data = minimalWeatherData;
      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded).toEqual(data);
    });

    it('should handle mixed extreme values', () => {
      const data = {
        ...minimalWeatherData,
        time: 2147483647,
        air_temperature: -100,
        brightness: 0,
        air_density: 999.999999,
        station_pressure: 0.000001,
        uv: 16,
        wind_avg: 1,
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.time).toBe(2147483647);
      expect(decoded.air_temperature).toBe(-100);
      expect(decoded.brightness).toBe(0);
      expect(decoded.air_density).toBeCloseTo(999.999999, 6);
      expect(decoded.station_pressure).toBeCloseTo(0.000001, 6);
      expect(decoded.uv).toBe(16);
      expect(decoded.wind_avg).toBe(1);
    });
  });
});
