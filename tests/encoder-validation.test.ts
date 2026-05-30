import { WeatherDataEncoder } from '../src/format/encoder';
import { WeatherData } from '../src/format/types';

// Valid sample data for baseline
const validData: WeatherData = {
  air_density: 1.225,
  air_temperature: 72,
  brightness: 50000,
  conditions: 'Clear',
  delta_t: 5,
  dew_point: 55,
  feels_like: 74,
  icon: 'clear-day',
  is_precip_local_day_rain_check: false,
  is_precip_local_yesterday_rain_check: false,
  lightning_strike_count_last_1hr: 0,
  lightning_strike_count_last_3hr: 0,
  lightning_strike_last_distance: 0,
  lightning_strike_last_distance_msg: '',
  lightning_strike_last_epoch: 1700000000,
  precip_accum_local_day: 0,
  precip_accum_local_yesterday: 0,
  precip_minutes_local_day: 0,
  precip_minutes_local_yesterday: 0,
  precip_probability: 10,
  pressure_trend: 'steady',
  relative_humidity: 45,
  sea_level_pressure: 1013,
  solar_radiation: 500,
  station_pressure: 29.92,
  time: 1700000000,
  uv: 5,
  wet_bulb_globe_temperature: 65,
  wet_bulb_temperature: 60,
  wind_avg: 10,
  wind_direction: 180,
  wind_direction_cardinal: 'S',
  wind_gust: 15,
};

describe('WeatherDataEncoder input validation', () => {
  const encoder = new WeatherDataEncoder();

  it('should encode valid data without errors', () => {
    expect(() => encoder.encode(validData)).not.toThrow();
  });

  it('should throw on missing required field', () => {
    const incomplete = { ...validData } as any;
    delete incomplete.air_temperature;
    expect(() => encoder.encode(incomplete)).toThrow(/missing required field.*air_temperature/i);
  });

  it('should throw on null data', () => {
    expect(() => encoder.encode(null as any)).toThrow(/invalid.*data/i);
  });

  it('should throw on undefined data', () => {
    expect(() => encoder.encode(undefined as any)).toThrow(/invalid.*data/i);
  });

  it('should throw when integer field receives NaN', () => {
    const bad = { ...validData, air_temperature: NaN };
    expect(() => encoder.encode(bad)).toThrow(/invalid value.*air_temperature.*NaN/i);
  });

  it('should throw when integer field receives Infinity', () => {
    const bad = { ...validData, wind_avg: Infinity };
    expect(() => encoder.encode(bad)).toThrow(/invalid value.*wind_avg/i);
  });

  it('should throw when float field receives NaN', () => {
    const bad = { ...validData, air_density: NaN };
    expect(() => encoder.encode(bad)).toThrow(/invalid value.*air_density.*NaN/i);
  });

  it('should throw when string field receives a number', () => {
    const bad = { ...validData, conditions: 42 as any };
    expect(() => encoder.encode(bad)).toThrow(/invalid type.*conditions.*expected string/i);
  });

  it('should throw when boolean field receives a string', () => {
    const bad = { ...validData, is_precip_local_day_rain_check: 'yes' as any };
    expect(() => encoder.encode(bad)).toThrow(/invalid type.*is_precip_local_day_rain_check.*expected boolean/i);
  });

  it('should throw when integer field receives a string', () => {
    const bad = { ...validData, uv: '5' as any };
    expect(() => encoder.encode(bad)).toThrow(/invalid type.*uv.*expected number/i);
  });
});
