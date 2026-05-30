import { FieldDefinition } from './types';

/**
 * Schema defining the field order and types for weather data encoding.
 * This order MUST be maintained for consistent encoding/decoding.
 * Fields are ordered logically by category for better readability.
 */
export const FIELD_SCHEMA: FieldDefinition[] = [
  { name: 'air_density', type: 'float', required: true },
  { name: 'air_temperature', type: 'integer', required: true },
  { name: 'brightness', type: 'integer', required: true },
  { name: 'conditions', type: 'string', required: true },
  { name: 'delta_t', type: 'integer', required: true },
  { name: 'dew_point', type: 'integer', required: true },
  { name: 'feels_like', type: 'integer', required: true },
  { name: 'icon', type: 'string', required: true },
  { name: 'is_precip_local_day_rain_check', type: 'boolean', required: true },
  { name: 'is_precip_local_yesterday_rain_check', type: 'boolean', required: true },
  { name: 'lightning_strike_count_last_1hr', type: 'integer', required: true },
  { name: 'lightning_strike_count_last_3hr', type: 'integer', required: true },
  { name: 'lightning_strike_last_distance', type: 'integer', required: true },
  { name: 'lightning_strike_last_distance_msg', type: 'string', required: true },
  { name: 'lightning_strike_last_epoch', type: 'integer', required: true },
  { name: 'precip_accum_local_day', type: 'integer', required: true },
  { name: 'precip_accum_local_yesterday', type: 'integer', required: true },
  { name: 'precip_minutes_local_day', type: 'integer', required: true },
  { name: 'precip_minutes_local_yesterday', type: 'integer', required: true },
  { name: 'precip_probability', type: 'integer', required: true },
  { name: 'pressure_trend', type: 'string', required: true },
  { name: 'relative_humidity', type: 'integer', required: true },
  { name: 'sea_level_pressure', type: 'integer', required: true },
  { name: 'solar_radiation', type: 'integer', required: true },
  { name: 'station_pressure', type: 'float', required: true },
  { name: 'time', type: 'integer', required: true },
  { name: 'uv', type: 'integer', required: true },
  { name: 'wet_bulb_globe_temperature', type: 'integer', required: true },
  { name: 'wet_bulb_temperature', type: 'integer', required: true },
  { name: 'wind_avg', type: 'integer', required: true },
  { name: 'wind_direction', type: 'integer', required: true },
  { name: 'wind_direction_cardinal', type: 'string', required: true },
  { name: 'wind_gust', type: 'integer', required: true },
];
