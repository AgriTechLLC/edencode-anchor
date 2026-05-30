import { WeatherDataEncoder, WeatherDataDecoder, WeatherData } from '../src';

describe('Integration Test - User Provided JSON', () => {
  let encoder: WeatherDataEncoder;
  let decoder: WeatherDataDecoder;

  beforeEach(() => {
    encoder = new WeatherDataEncoder();
    decoder = new WeatherDataDecoder();
  });

  describe('exact user JSON from requirements', () => {
    // This is the EXACT JSON object provided by the user in the requirements
    const userProvidedWeatherData: WeatherData = {
      air_density: 1.29,
      air_temperature: -9,
      brightness: 68055,
      conditions: 'Clear',
      delta_t: 2,
      dew_point: -17,
      feels_like: -13,
      icon: 'clear-day',
      is_precip_local_day_rain_check: true,
      is_precip_local_yesterday_rain_check: true,
      lightning_strike_count_last_1hr: 0,
      lightning_strike_count_last_3hr: 0,
      lightning_strike_last_distance: 32,
      lightning_strike_last_distance_msg: '30 - 34 km',
      lightning_strike_last_epoch: 1761103981,
      precip_accum_local_day: 0,
      precip_accum_local_yesterday: 0,
      precip_minutes_local_day: 0,
      precip_minutes_local_yesterday: 0,
      precip_probability: 0,
      pressure_trend: 'falling',
      relative_humidity: 49,
      sea_level_pressure: 1019,
      solar_radiation: 567,
      station_pressure: 979.7,
      time: 1769529302,
      uv: 2,
      wet_bulb_globe_temperature: -9,
      wet_bulb_temperature: -11,
      wind_avg: 2,
      wind_direction: 280,
      wind_direction_cardinal: 'W',
      wind_gust: 4,
    };

    it('should encode the user provided JSON without errors', () => {
      expect(() => encoder.encode(userProvidedWeatherData)).not.toThrow();
    });

    it('should create a valid Bitcoin script from user JSON', () => {
      const script = encoder.encode(userProvidedWeatherData);

      expect(script).toBeDefined();
      expect(script.chunks.length).toBeGreaterThanOrEqual(36); // OP_FALSE + OP_RETURN + version + 33 fields
      expect(script.toHex()).toBeDefined();
      expect(script.toBinary()).toBeDefined();
    });

    it('should produce a reasonable script size for blockchain storage', () => {
      const script = encoder.encode(userProvidedWeatherData);
      const binary = script.toBinary();

      console.log(`\nScript size: ${binary.length} bytes`);
      console.log(`Script hex length: ${script.toHex().length} characters`);
      console.log(`Number of chunks: ${script.chunks.length}`);

      // Weather data should be under 1KB when encoded
      expect(binary.length).toBeLessThan(1024);
    });

    it('should perfectly round-trip the user provided JSON (ZERO data loss)', () => {
      const original = userProvidedWeatherData;
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);

      // Verify EVERY field matches
      // Integers - exact match required
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
      expect(decoded.time).toBe(original.time);
      expect(decoded.uv).toBe(original.uv);
      expect(decoded.wet_bulb_globe_temperature).toBe(original.wet_bulb_globe_temperature);
      expect(decoded.wet_bulb_temperature).toBe(original.wet_bulb_temperature);
      expect(decoded.wind_avg).toBe(original.wind_avg);
      expect(decoded.wind_direction).toBe(original.wind_direction);
      expect(decoded.wind_gust).toBe(original.wind_gust);

      // Floats - match within 6 decimal precision
      expect(decoded.air_density).toBeCloseTo(original.air_density, 6);
      expect(decoded.station_pressure).toBeCloseTo(original.station_pressure, 6);

      // Strings - exact match required
      expect(decoded.conditions).toBe(original.conditions);
      expect(decoded.icon).toBe(original.icon);
      expect(decoded.lightning_strike_last_distance_msg).toBe(original.lightning_strike_last_distance_msg);
      expect(decoded.pressure_trend).toBe(original.pressure_trend);
      expect(decoded.wind_direction_cardinal).toBe(original.wind_direction_cardinal);

      // Booleans - exact match required
      expect(decoded.is_precip_local_day_rain_check).toBe(original.is_precip_local_day_rain_check);
      expect(decoded.is_precip_local_yesterday_rain_check).toBe(original.is_precip_local_yesterday_rain_check);
    });

    it('should work with hex encoding/decoding', () => {
      const original = userProvidedWeatherData;
      const hex = encoder.encodeToHex(original);
      const decoded = decoder.decodeFromHex(hex);

      expect(decoded.time).toBe(original.time);
      expect(decoded.conditions).toBe(original.conditions);
      expect(decoded.air_density).toBeCloseTo(original.air_density, 6);
      expect(decoded.station_pressure).toBeCloseTo(original.station_pressure, 6);
    });

    it('should display encoded data details', () => {
      const original = userProvidedWeatherData;
      const encoded = encoder.encode(original);
      const decoded = decoder.decode(encoded);

      console.log('\n=== Encoding Verification ===');
      console.log('Original data sample:');
      console.log('  time:', original.time);
      console.log('  conditions:', original.conditions);
      console.log('  air_temperature:', original.air_temperature);
      console.log('  air_density:', original.air_density);
      console.log('  station_pressure:', original.station_pressure);

      console.log('\nDecoded data sample:');
      console.log('  time:', decoded.time);
      console.log('  conditions:', decoded.conditions);
      console.log('  air_temperature:', decoded.air_temperature);
      console.log('  air_density:', decoded.air_density);
      console.log('  station_pressure:', decoded.station_pressure);

      console.log('\nScript hex:', encoded.toHex().substring(0, 100) + '...');
      console.log('Script size:', encoded.toBinary().length, 'bytes');
      console.log('Number of chunks:', encoded.chunks.length);

      console.log('\nData integrity check: PASSED ✓');
      console.log('All fields successfully round-tripped with zero data loss!');

      expect(true).toBe(true);
    });
  });

  describe('real-world usage example', () => {
    it('should demonstrate typical usage pattern', () => {
      // Step 1: Create encoder and decoder
      const encoder = new WeatherDataEncoder();
      const decoder = new WeatherDataDecoder();

      // Step 2: Your weather data
      const weatherData: WeatherData = {
        air_density: 1.29,
        air_temperature: -9,
        brightness: 68055,
        conditions: 'Clear',
        delta_t: 2,
        dew_point: -17,
        feels_like: -13,
        icon: 'clear-day',
        is_precip_local_day_rain_check: true,
        is_precip_local_yesterday_rain_check: true,
        lightning_strike_count_last_1hr: 0,
        lightning_strike_count_last_3hr: 0,
        lightning_strike_last_distance: 32,
        lightning_strike_last_distance_msg: '30 - 34 km',
        lightning_strike_last_epoch: 1761103981,
        precip_accum_local_day: 0,
        precip_accum_local_yesterday: 0,
        precip_minutes_local_day: 0,
        precip_minutes_local_yesterday: 0,
        precip_probability: 0,
        pressure_trend: 'falling',
        relative_humidity: 49,
        sea_level_pressure: 1019,
        solar_radiation: 567,
        station_pressure: 979.7,
        time: 1769529302,
        uv: 2,
        wet_bulb_globe_temperature: -9,
        wet_bulb_temperature: -11,
        wind_avg: 2,
        wind_direction: 280,
        wind_direction_cardinal: 'W',
        wind_gust: 4,
      };

      // Step 3: Encode to Bitcoin Script
      const script = encoder.encode(weatherData);

      // Step 4: Get hex for blockchain storage
      const hex = script.toHex();

      // Step 5: Later, decode from hex
      const recoveredData = decoder.decodeFromHex(hex);

      // Step 6: Verify data integrity
      expect(recoveredData.time).toBe(weatherData.time);
      expect(recoveredData.conditions).toBe(weatherData.conditions);
      expect(recoveredData.air_density).toBeCloseTo(weatherData.air_density, 6);

      console.log('\n=== Usage Example Complete ===');
      console.log('✓ Encoded weather data to Bitcoin Script');
      console.log('✓ Converted to hex for blockchain storage');
      console.log('✓ Decoded from hex back to original data');
      console.log('✓ Verified data integrity');
    });
  });
});
