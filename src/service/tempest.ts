import { config } from '../config/env';
import { WeatherData } from '../format/types';

/**
 * Structured error for Tempest API failures.
 * Carries the HTTP status code and an `isRetryable` flag so callers
 * can distinguish transient (5xx, 429) from permanent (4xx) errors.
 */
export class TempestAPIError extends Error {
  public readonly statusCode: number;
  /** True for transient errors that can be retried (5xx, 429, network) */
  public readonly isRetryable: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'TempestAPIError';
    this.statusCode = statusCode;
    // Retry on server errors (5xx) and rate limits (429); fail fast on client errors (4xx)
    this.isRetryable = statusCode === 429 || statusCode >= 500;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TempestAPIError.prototype);
  }
}

/** Retry config — can be overridden in tests via TEMPEST_RETRY_DELAY_MS env var */
const RETRY_CONFIG = {
  maxAttempts: 3,
  // In test environments set TEMPEST_RETRY_DELAY_MS=0 for fast tests
  baseDelayMs: process.env.TEMPEST_RETRY_DELAY_MS !== undefined
    ? parseInt(process.env.TEMPEST_RETRY_DELAY_MS, 10)
    : 200,   // 200ms → 400ms → 800ms in production
  maxDelayMs: 5000,
} as const;

/**
 * Execute `fn` with exponential-backoff retry for transient errors.
 * Network-level errors (fetch throws) are always retried.
 * TempestAPIErrors are retried only if `isRetryable === true`.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isApiError = err instanceof TempestAPIError;
      const shouldRetry = !isApiError || err.isRetryable;

      if (!shouldRetry || attempt === RETRY_CONFIG.maxAttempts) {
        break;
      }

      const delay = Math.min(
        RETRY_CONFIG.baseDelayMs * 2 ** (attempt - 1),
        RETRY_CONFIG.maxDelayMs,
      );
      console.warn(`[tempest] ${label} failed (attempt ${attempt}/${RETRY_CONFIG.maxAttempts}), retrying in ${delay}ms:`, err);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastError;
}

/**
 * Tempest API station interface
 */
interface TempestStation {
  station_id: number;
  name?: string;
}

/**
 * Tempest API response for stations
 */
interface StationsResponse {
  stations: TempestStation[];
}

/**
 * Tempest API current conditions response
 */
interface CurrentConditionsResponse {
  current_conditions: any;
}

/**
 * Get list of station IDs from Tempest API
 *
 * @returns {Promise<number[]>} Array of station IDs
 */
export async function getStations(): Promise<number[]> {
  const url = `https://swd.weatherflow.com/swd/rest/stations?token=${config.TEMPEST_API_KEY}`;

  return withRetry(async () => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new TempestAPIError(
        `Tempest API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const data = await response.json() as StationsResponse;

    if (!data.stations || !Array.isArray(data.stations)) {
      throw new TempestAPIError('Invalid response format from Tempest API', 200);
    }

    return data.stations.map((s) => s.station_id);
  }, 'getStations');
}

/**
 * Get current weather conditions for a station
 *
 * @param {number} stationId - The station ID
 * @returns {Promise<WeatherData>} The weather data
 */
export async function getCurrentConditions(stationId: number): Promise<WeatherData> {
  const url = `https://swd.weatherflow.com/swd/rest/better_forecast?station_id=${stationId}&token=${config.TEMPEST_API_KEY}`;

  return withRetry(async () => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new TempestAPIError(
        `Tempest API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const data = await response.json() as CurrentConditionsResponse;

    if (!data.current_conditions) {
      throw new TempestAPIError('No current conditions in response', 200);
    }

    return mapToWeatherData(data.current_conditions);
  }, `getCurrentConditions(${stationId})`);
}

/**
 * Map Tempest API current_conditions to WeatherData format
 *
 * @param {any} cc - The current_conditions object from Tempest API
 * @returns {WeatherData} The mapped weather data
 */
function mapToWeatherData(cc: any): WeatherData {
  return {
    air_density: parseFloat(cc.air_density ?? 0),
    air_temperature: parseInt(cc.air_temperature ?? 0, 10),
    brightness: parseInt(cc.brightness ?? 0, 10),
    conditions: String(cc.conditions ?? ''),
    delta_t: parseInt(cc.delta_t ?? 0, 10),
    dew_point: parseInt(cc.dew_point ?? 0, 10),
    feels_like: parseInt(cc.feels_like ?? 0, 10),
    icon: String(cc.icon ?? ''),
    is_precip_local_day_rain_check: Boolean(cc.is_precip_local_day_rain_check ?? false),
    is_precip_local_yesterday_rain_check: Boolean(cc.is_precip_local_yesterday_rain_check ?? false),
    lightning_strike_count_last_1hr: parseInt(cc.lightning_strike_count_last_1hr ?? 0, 10),
    lightning_strike_count_last_3hr: parseInt(cc.lightning_strike_count_last_3hr ?? 0, 10),
    lightning_strike_last_distance: parseInt(cc.lightning_strike_last_distance ?? 0, 10),
    lightning_strike_last_distance_msg: String(cc.lightning_strike_last_distance_msg ?? ''),
    lightning_strike_last_epoch: parseInt(cc.lightning_strike_last_epoch ?? 0, 10),
    precip_accum_local_day: parseInt(cc.precip_accum_local_day ?? 0, 10),
    precip_accum_local_yesterday: parseInt(cc.precip_accum_local_yesterday ?? 0, 10),
    precip_minutes_local_day: parseInt(cc.precip_minutes_local_day ?? 0, 10),
    precip_minutes_local_yesterday: parseInt(cc.precip_minutes_local_yesterday ?? 0, 10),
    precip_probability: parseInt(cc.precip_probability ?? 0, 10),
    pressure_trend: String(cc.pressure_trend ?? ''),
    relative_humidity: parseInt(cc.relative_humidity ?? 0, 10),
    sea_level_pressure: parseInt(cc.sea_level_pressure ?? 0, 10),
    solar_radiation: parseInt(cc.solar_radiation ?? 0, 10),
    station_pressure: parseFloat(cc.station_pressure ?? 0),
    time: parseInt(cc.time ?? 0, 10),
    uv: parseInt(cc.uv ?? 0, 10),
    wet_bulb_globe_temperature: parseInt(cc.wet_bulb_globe_temperature ?? 0, 10),
    wet_bulb_temperature: parseInt(cc.wet_bulb_temperature ?? 0, 10),
    wind_avg: parseInt(cc.wind_avg ?? 0, 10),
    wind_direction: parseInt(cc.wind_direction ?? 0, 10),
    wind_direction_cardinal: String(cc.wind_direction_cardinal ?? ''),
    wind_gust: parseInt(cc.wind_gust ?? 0, 10),
  };
}
