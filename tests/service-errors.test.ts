/**
 * Service layer error handling tests
 * Covers: transaction validation, tempest API error paths, mapToWeatherData defaults
 *
 * FIX (2026-03-07): Added `await` to all `.rejects.toThrow()` assertions — they were
 * previously unhandled Promises that passed vacuously (Jest does NOT fail on unawaited
 * rejects by default). Also added TEMPEST_RETRY_DELAY_MS=0 to prevent 600ms+ waits
 * from retry back-off and cross-test mock pollution via background retry loops.
 */

// Zero-delay retries so tests run in milliseconds, not seconds
// Also prevents retry loops from one test bleeding into the next test's fetch mock
process.env.TEMPEST_RETRY_DELAY_MS = '0';

// ── Transaction validation (no wallet mocking needed) ─────────────────────
import { createWeatherTransaction } from '../src/service/transaction';
import { config } from '../src/config/env';

describe('createWeatherTransaction — input validation', () => {
  it('should throw when records array is empty', async () => {
    await expect(createWeatherTransaction([])).rejects.toThrow(
      'No records provided for transaction'
    );
  });

  it('should throw when too many records are provided', async () => {
    const tooMany = Array(config.WEATHER_OUTPUTS_PER_TX + 1).fill({
      data: { air_temperature: 0 },
    });
    await expect(createWeatherTransaction(tooMany)).rejects.toThrow(
      /Too many records/
    );
  });
});

// ── Tempest API error handling ────────────────────────────────────────────
import { getStations, getCurrentConditions } from '../src/service/tempest';

describe('Tempest API — error handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('getStations should throw on non-OK response', async () => {
    global.fetch = (() => Promise.resolve({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })) as any;

    await expect(getStations()).rejects.toThrow('Tempest API error: 401 Unauthorized');
  });

  it('getStations should throw on invalid response format', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: async () => ({ stations: 'not-an-array' }),
    })) as any;

    await expect(getStations()).rejects.toThrow('Invalid response format from Tempest API');
  });

  it('getStations should throw when stations field is missing', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: async () => ({}),
    })) as any;

    await expect(getStations()).rejects.toThrow('Invalid response format from Tempest API');
  });

  it('getStations should return station IDs on success', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: async () => ({ stations: [{ station_id: 101 }, { station_id: 202 }] }),
    })) as any;

    const ids = await getStations();
    expect(ids).toEqual([101, 202]);
  });

  it('getCurrentConditions should throw on non-OK response', async () => {
    global.fetch = (() => Promise.resolve({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })) as any;

    await expect(getCurrentConditions(123)).rejects.toThrow(
      'Tempest API error: 500 Internal Server Error'
    );
  });

  it('getCurrentConditions should throw when current_conditions is missing', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: async () => ({}),
    })) as any;

    await expect(getCurrentConditions(123)).rejects.toThrow(
      'No current conditions in response'
    );
  });

  it('getCurrentConditions should map valid response to WeatherData', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: async () => ({
        current_conditions: {
          air_density: '1.29',
          air_temperature: '22',
          brightness: '5000',
          conditions: 'Clear',
          delta_t: '3',
          dew_point: '10',
          feels_like: '21',
          icon: 'clear-day',
          is_precip_local_day_rain_check: true,
          is_precip_local_yesterday_rain_check: false,
          lightning_strike_count_last_1hr: '0',
          lightning_strike_count_last_3hr: '0',
          lightning_strike_last_distance: '0',
          lightning_strike_last_distance_msg: 'none',
          lightning_strike_last_epoch: '0',
          precip_accum_local_day: '0',
          precip_accum_local_yesterday: '0',
          precip_minutes_local_day: '0',
          precip_minutes_local_yesterday: '0',
          precip_probability: '10',
          pressure_trend: 'rising',
          relative_humidity: '55',
          sea_level_pressure: '1013',
          solar_radiation: '200',
          station_pressure: '1010.5',
          time: '1709000000',
          uv: '3',
          wet_bulb_globe_temperature: '18',
          wet_bulb_temperature: '15',
          wind_avg: '5',
          wind_direction: '180',
          wind_direction_cardinal: 'S',
          wind_gust: '8',
        },
      }),
    })) as any;

    const data = await getCurrentConditions(123);
    expect(data.air_density).toBeCloseTo(1.29);
    expect(data.air_temperature).toBe(22);
    expect(data.conditions).toBe('Clear');
    expect(data.is_precip_local_day_rain_check).toBe(true);
    expect(data.wind_direction_cardinal).toBe('S');
  });

  it('getCurrentConditions should handle missing fields with defaults', async () => {
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: async () => ({
        current_conditions: {
          air_temperature: '15',
          conditions: 'Rainy',
        },
      }),
    })) as any;

    const data = await getCurrentConditions(123);
    expect(data.air_temperature).toBe(15);
    expect(data.conditions).toBe('Rainy');
    expect(data.air_density).toBe(0);
    expect(data.brightness).toBe(0);
    expect(data.icon).toBe('');
    expect(data.is_precip_local_day_rain_check).toBe(false);
    expect(data.wind_direction_cardinal).toBe('');
  });

  it('getStations should propagate network errors', async () => {
    global.fetch = (() => Promise.reject(new Error('Network timeout'))) as any;

    await expect(getStations()).rejects.toThrow('Network timeout');
  });

  it('getCurrentConditions should propagate network errors', async () => {
    global.fetch = (() => Promise.reject(new Error('DNS resolution failed'))) as any;

    await expect(getCurrentConditions(456)).rejects.toThrow('DNS resolution failed');
  });
});
