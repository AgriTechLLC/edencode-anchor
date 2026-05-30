/**
 * Weather data structure for blockchain encoding
 */
export interface WeatherData {
  air_density: number;
  air_temperature: number;
  brightness: number;
  conditions: string;
  delta_t: number;
  dew_point: number;
  feels_like: number;
  icon: string;
  is_precip_local_day_rain_check: boolean;
  is_precip_local_yesterday_rain_check: boolean;
  lightning_strike_count_last_1hr: number;
  lightning_strike_count_last_3hr: number;
  lightning_strike_last_distance: number;
  lightning_strike_last_distance_msg: string;
  lightning_strike_last_epoch: number;
  precip_accum_local_day: number;
  precip_accum_local_yesterday: number;
  precip_minutes_local_day: number;
  precip_minutes_local_yesterday: number;
  precip_probability: number;
  pressure_trend: string;
  relative_humidity: number;
  sea_level_pressure: number;
  solar_radiation: number;
  station_pressure: number;
  time: number;
  uv: number;
  wet_bulb_globe_temperature: number;
  wet_bulb_temperature: number;
  wind_avg: number;
  wind_direction: number;
  wind_direction_cardinal: string;
  wind_gust: number;
}

/**
 * Field data types for encoding/decoding
 */
export type FieldType = 'integer' | 'float' | 'string' | 'boolean';

/**
 * Field definition in the schema
 */
export interface FieldDefinition {
  name: keyof WeatherData;
  type: FieldType;
  required: boolean;
}
