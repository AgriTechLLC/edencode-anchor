import { WeatherDataEncoder } from '../src/format/encoder';
import { WeatherDataDecoder } from '../src/format/decoder';
import { WeatherData } from '../src/format/types';
import { sampleWeatherData, minimalWeatherData, extremeWeatherData } from './fixtures/weather-samples';
import { FLOAT_EPSILON } from '../src/format/constants';

describe('Encode/Decode Round-trip', () => {
  let encoder: WeatherDataEncoder;
  let decoder: WeatherDataDecoder;

  beforeEach(() => {
    encoder = new WeatherDataEncoder();
    decoder = new WeatherDataDecoder();
  });

  describe('perfect round-trip', () => {
    it('should perfectly round-trip complete sample weather data', () => {
      const original = sampleWeatherData;
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);

      // Integer fields should match exactly
      expect(decoded.time).toBe(original.time);
      expect(decoded.air_temperature).toBe(original.air_temperature);
      expect(decoded.brightness).toBe(original.brightness);
      expect(decoded.delta_t).toBe(original.delta_t);
      expect(decoded.dew_point).toBe(original.dew_point);
      expect(decoded.feels_like).toBe(original.feels_like);
      expect(decoded.lightning_strike_count_last_1hr).toBe(original.lightning_strike_count_last_1hr);
      expect(decoded.lightning_strike_count_last_3hr).toBe(original.lightning_strike_count_last_3hr);
      expect(decoded.lightning_strike_last_distance).toBe(original.lightning_strike_last_distance);
      expect(decoded.lightning_strike_last_epoch).toBe(original.lightning_strike_last_epoch);
      expect(decoded.precip_accum_local_day).toBe(original.precip_accum_local_day);
      expect(decoded.precip_accum_local_yesterday).toBe(original.precip_accum_local_yesterday);
      expect(decoded.precip_minutes_local_day).toBe(original.precip_minutes_local_day);
      expect(decoded.precip_minutes_local_yesterday).toBe(original.precip_minutes_local_yesterday);
      expect(decoded.precip_probability).toBe(original.precip_probability);
      expect(decoded.relative_humidity).toBe(original.relative_humidity);
      expect(decoded.sea_level_pressure).toBe(original.sea_level_pressure);
      expect(decoded.solar_radiation).toBe(original.solar_radiation);
      expect(decoded.uv).toBe(original.uv);
      expect(decoded.wet_bulb_globe_temperature).toBe(original.wet_bulb_globe_temperature);
      expect(decoded.wet_bulb_temperature).toBe(original.wet_bulb_temperature);
      expect(decoded.wind_avg).toBe(original.wind_avg);
      expect(decoded.wind_direction).toBe(original.wind_direction);
      expect(decoded.wind_gust).toBe(original.wind_gust);

      // Float fields should match within epsilon
      expect(decoded.air_density).toBeCloseTo(original.air_density, 6);
      expect(decoded.station_pressure).toBeCloseTo(original.station_pressure, 6);

      // String fields should match exactly
      expect(decoded.conditions).toBe(original.conditions);
      expect(decoded.icon).toBe(original.icon);
      expect(decoded.lightning_strike_last_distance_msg).toBe(original.lightning_strike_last_distance_msg);
      expect(decoded.pressure_trend).toBe(original.pressure_trend);
      expect(decoded.wind_direction_cardinal).toBe(original.wind_direction_cardinal);

      // Boolean fields should match exactly
      expect(decoded.is_precip_local_day_rain_check).toBe(original.is_precip_local_day_rain_check);
      expect(decoded.is_precip_local_yesterday_rain_check).toBe(original.is_precip_local_yesterday_rain_check);
    });

    it('should perfectly round-trip minimal weather data', () => {
      const original = minimalWeatherData;
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);

      // All integer fields should be 0
      expect(decoded.time).toBe(0);
      expect(decoded.air_temperature).toBe(0);

      // All float fields should be 0
      expect(decoded.air_density).toBe(0);
      expect(decoded.station_pressure).toBe(0);

      // All string fields should be empty
      expect(decoded.conditions).toBe('');
      expect(decoded.icon).toBe('');

      // All boolean fields should be false
      expect(decoded.is_precip_local_day_rain_check).toBe(false);
      expect(decoded.is_precip_local_yesterday_rain_check).toBe(false);
    });

    it('should perfectly round-trip extreme weather data', () => {
      const original = extremeWeatherData;
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);

      // Check key extreme values
      expect(decoded.air_temperature).toBe(original.air_temperature);
      expect(decoded.brightness).toBe(original.brightness);
      expect(decoded.air_density).toBeCloseTo(original.air_density, 6);
      expect(decoded.station_pressure).toBeCloseTo(original.station_pressure, 6);
      expect(decoded.conditions).toBe(original.conditions);
      expect(decoded.lightning_strike_last_distance_msg).toBe(original.lightning_strike_last_distance_msg);
    });
  });

  describe('handle all data types losslessly', () => {
    it('should handle all integer values losslessly', () => {
      const testValues = [-100, -1, 0, 1, 16, 17, 255, 1000, 1769529302];

      testValues.forEach(value => {
        const data = { ...minimalWeatherData, time: value };
        const encoded = encoder.encode(data);
        const decoded = decoder.decode(encoded);
        expect(decoded.time).toBe(value);
      });
    });

    it('should handle all float values within precision', () => {
      const testValues = [0, 0.000001, 0.5, 1.29, 979.7, 999.999999, -1.5, -979.7];

      testValues.forEach(value => {
        const data = { ...minimalWeatherData, air_density: value };
        const encoded = encoder.encode(data);
        const decoded = decoder.decode(encoded);
        expect(Math.abs(decoded.air_density - value)).toBeLessThan(FLOAT_EPSILON);
      });
    });

    it('should handle all string encodings losslessly', () => {
      const testStrings = [
        '',
        'A',
        'Clear',
        'Test 测试 ⚡️',
        'Special chars: !@#$%^&*()',
        'A'.repeat(100),
      ];

      testStrings.forEach(str => {
        const data = { ...minimalWeatherData, conditions: str };
        const encoded = encoder.encode(data);
        const decoded = decoder.decode(encoded);
        expect(decoded.conditions).toBe(str);
      });
    });

    it('should handle boolean values losslessly', () => {
      const testData = [
        { ...minimalWeatherData, is_precip_local_day_rain_check: true },
        { ...minimalWeatherData, is_precip_local_day_rain_check: false },
        {
          ...minimalWeatherData,
          is_precip_local_day_rain_check: true,
          is_precip_local_yesterday_rain_check: false,
        },
      ];

      testData.forEach(data => {
        const encoded = encoder.encode(data);
        const decoded = decoder.decode(encoded);
        expect(decoded.is_precip_local_day_rain_check).toBe(data.is_precip_local_day_rain_check);
        expect(decoded.is_precip_local_yesterday_rain_check).toBe(data.is_precip_local_yesterday_rain_check);
      });
    });
  });

  describe('float precision round-trip', () => {
    it('should preserve float precision within tolerance', () => {
      const data: WeatherData = {
        ...minimalWeatherData,
        air_density: 1.123456,
        station_pressure: 1234.567890,
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      expect(decoded.air_density).toBeCloseTo(data.air_density, 6);
      expect(decoded.station_pressure).toBeCloseTo(data.station_pressure, 6);
    });

    it('should handle precision limits correctly', () => {
      // Values with more than 6 decimal places will lose precision
      const data: WeatherData = {
        ...minimalWeatherData,
        air_density: 1.123456789, // 9 decimal places
      };

      const encoded = encoder.encode(data);
      const decoded = decoder.decode(encoded);

      // Should be close but not exact due to rounding
      expect(decoded.air_density).toBeCloseTo(data.air_density, 6);

      // Verify it's within our epsilon
      expect(Math.abs(decoded.air_density - data.air_density)).toBeLessThan(FLOAT_EPSILON);
    });
  });

  describe('hex serialization round-trip', () => {
    it('should work with hex encoding/decoding', () => {
      const original = sampleWeatherData;
      const hex = encoder.encodeToHex(original);
      const decoded = decoder.decodeFromHex(hex);

      expect(decoded.time).toBe(original.time);
      expect(decoded.conditions).toBe(original.conditions);
      expect(decoded.air_density).toBeCloseTo(original.air_density, 6);
    });

    it('should produce consistent hex output', () => {
      const hex1 = encoder.encodeToHex(sampleWeatherData);
      const hex2 = encoder.encodeToHex(sampleWeatherData);
      expect(hex1).toBe(hex2);
    });
  });

  describe('multiple round-trips', () => {
    it('should maintain integrity through multiple encode/decode cycles', () => {
      let data = sampleWeatherData;

      // Perform 5 round-trips
      for (let i = 0; i < 5; i++) {
        const encoded = encoder.encode(data);
        data = decoder.decode(encoded);
      }

      // After 5 round-trips, data should still match original
      expect(data.time).toBe(sampleWeatherData.time);
      expect(data.conditions).toBe(sampleWeatherData.conditions);
      expect(data.air_density).toBeCloseTo(sampleWeatherData.air_density, 6);
    });
  });

  describe('ensure ZERO data loss', () => {
    it('should validate that all 33 fields are preserved', () => {
      const original = sampleWeatherData;
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);

      // Verify every single field
      const fieldNames = Object.keys(original) as (keyof WeatherData)[];
      expect(fieldNames.length).toBe(33); // Ensure we have all fields

      fieldNames.forEach(fieldName => {
        const originalValue = original[fieldName];
        const decodedValue = decoded[fieldName];

        if (typeof originalValue === 'number') {
          if (fieldName === 'air_density' || fieldName === 'station_pressure') {
            // Float fields
            expect(decodedValue).toBeCloseTo(originalValue as number, 6);
          } else {
            // Integer fields
            expect(decodedValue).toBe(originalValue);
          }
        } else {
          // String and boolean fields
          expect(decodedValue).toBe(originalValue);
        }
      });
    });
  });
});
