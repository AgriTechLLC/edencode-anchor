/**
 * Tempest API WebSocket Client
 * Real-time weather data streaming for Weather Chain
 *
 * Based on Tempest WebSocket API documentation:
 * - Endpoint: wss://ws.weatherflow.com
 * - Message types: obs_air, obs_sky, obs_st, rapid_wind, evt_strike, evt_precip
 * - Standard observations: ~1 minute intervals
 * - Rapid wind: ~3 second intervals
 */

import WebSocket from 'ws';
import { WeatherData } from '../format/types';
import { config } from '../config/env';
import { NotificationService } from '../notification/interface';

/**
 * WebSocket message types from Tempest
 */
type TempestMessageType =
  | 'obs_air'      // Air sensor observations
  | 'obs_sky'      // Sky sensor observations
  | 'obs_st'       // Storm sensor observations
  | 'rapid_wind'   // Rapid wind updates
  | 'evt_strike'   // Lightning strike event
  | 'evt_precip';  // Precipitation event

/**
 * Base Tempest WebSocket message structure
 */
interface TempestMessage {
  type: TempestMessageType;
  device_id: number;
  [key: string]: any;
}

/**
 * Observation message structure
 */
interface TempestObservation extends TempestMessage {
  type: 'obs_air' | 'obs_sky' | 'obs_st';
  obs: number[];
  firmware_revision: number;
  hub_sn: string;
  ts: number;
}

/**
 * Rapid wind message structure
 */
interface TempestRapidWind extends TempestMessage {
  type: 'rapid_wind';
  ob: number[];
  serial_number: string;
  hub_sn: string;
  ts: number;
}

/**
 * WebSocket client options
 */
export interface WebSocketClientOptions {
  apiToken: string;
  stationId: number;
  onObservation?: (data: WeatherData) => void;
  onRapidWind?: (data: Partial<WeatherData>) => void;
  onEvent?: (event: string, data: any) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Tempest WebSocket Client class
 */
export class TempestWebSocketClient {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // Start with 5 seconds

  constructor(options: WebSocketClientOptions) {
    this.options = options;
  }

  /**
   * Connect to Tempest WebSocket API
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection in progress');
      return;
    }

    this.isConnecting = true;
    console.log(`Connecting to Tempest WebSocket (station: ${this.options.stationId})...`);

    this.ws = new WebSocket('wss://ws.weatherflow.com/swd/stream');

    this.ws.on('open', () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;
      console.log('✓ Connected to Tempest WebSocket');

      // Send listen message
      this.sendListen();

      this.options.onConnect?.();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.options.onError?.(error);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.isConnected = false;
      this.isConnecting = false;
      console.log(`WebSocket closed: ${code} ${reason.toString()}`);

      this.options.onDisconnect?.();

      // Attempt reconnection
      this.scheduleReconnect();
    });
  }

  /**
   * Send listen message to subscribe to station data
   */
  private sendListen(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const listenMessage = {
      type: 'listen_start',
      device_id: this.options.stationId,
      id: `weather-chain-${Date.now()}`,
    };

    this.ws.send(JSON.stringify(listenMessage));
    console.log(`Listening to station ${this.options.stationId}`);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: string): void {
    try {
      const data = JSON.parse(message) as TempestMessage;

      switch (data.type) {
        case 'obs_air':
        case 'obs_sky':
        case 'obs_st':
          this.handleObservation(data as TempestObservation);
          break;

        case 'rapid_wind':
          this.handleRapidWind(data as TempestRapidWind);
          break;

        case 'evt_strike':
        case 'evt_precip':
          this.handleEvent(data);
          break;

        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle observation message (air, sky, storm sensors)
   */
  private handleObservation(msg: TempestObservation): void {
    const obs = msg.obs;

    // Map Tempest observation array to WeatherData
    // Based on Tempest API documentation for obs array structure
    const weatherData: WeatherData = {
      air_density: 0,
      air_temperature: 0,
      brightness: 0,
      conditions: '',
      delta_t: 0,
      dew_point: 0,
      feels_like: 0,
      icon: '',
      is_precip_local_day_rain_check: false,
      is_precip_local_yesterday_rain_check: false,
      lightning_strike_count_last_1hr: 0,
      lightning_strike_count_last_3hr: 0,
      lightning_strike_last_distance: 0,
      lightning_strike_last_distance_msg: '',
      lightning_strike_last_epoch: 0,
      precip_accum_local_day: 0,
      precip_accum_local_yesterday: 0,
      precip_minutes_local_day: 0,
      precip_minutes_local_yesterday: 0,
      precip_probability: 0,
      pressure_trend: '',
      relative_humidity: 0,
      sea_level_pressure: 0,
      solar_radiation: 0,
      station_pressure: 0,
      time: Date.now(),
      uv: 0,
      wet_bulb_globe_temperature: 0,
      wet_bulb_temperature: 0,
      wind_avg: 0,
      wind_direction: 0,
      wind_direction_cardinal: '',
      wind_gust: 0,
    };

    // Map observation values based on sensor type
    // Note: This is a simplified mapping. Full implementation would need
    // to parse the exact observation structure for each sensor type.
    if (msg.type === 'obs_air') {
      // Air sensor observations
      weatherData.air_temperature = obs[0] || 0;
      weatherData.station_pressure = obs[1] || 0;
      weatherData.relative_humidity = obs[2] || 0;
      weatherData.wind_avg = obs[5] || 0;
      weatherData.wind_direction = obs[6] || 0;
      weatherData.wind_gust = obs[7] || 0;
      weatherData.lightning_strike_count_last_1hr = obs[8] || 0;
      // obs[9] is lightning count last 3hr
      weatherData.precip_accum_local_day = obs[10] || 0;
      weatherData.precip_minutes_local_day = obs[11] || 0; // Using as minutes
    } else if (msg.type === 'obs_sky') {
      // Sky sensor observations
      weatherData.brightness = obs[1] || 0;
      weatherData.uv = obs[2] || 0;
      weatherData.solar_radiation = obs[6] || 0;
      weatherData.precip_accum_local_day = obs[8] || 0;
    }

    this.options.onObservation?.(weatherData);
  }

  /**
   * Handle rapid wind message
   */
  private handleRapidWind(msg: TempestRapidWind): void {
    const ob = msg.ob;

    const windData: Partial<WeatherData> = {
      time: msg.ts,
      wind_avg: ob[0] || 0,
      wind_direction: ob[1] || 0,
      wind_gust: ob[2] || 0,
    };

    this.options.onRapidWind?.(windData);
  }

  /**
   * Handle event messages (strike, precip)
   */
  private handleEvent(msg: TempestMessage): void {
    console.log(`Event: ${msg.type}`, msg);
    this.options.onEvent?.(msg.type, msg);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${Math.round(delay / 1000)} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    console.log('WebSocket disconnected');
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

/**
 * Create a WebSocket client for a station
 */
export function createWebSocketClient(
  stationId: number,
  notification?: NotificationService
): TempestWebSocketClient {
  return new TempestWebSocketClient({
    apiToken: config.TEMPEST_API_KEY,
    stationId,
    onObservation: (data) => {
      console.log(`[WebSocket] Observation received at ${data.time}`);
      // Will be handled by stream service
    },
    onRapidWind: (data) => {
      console.log(`[WebSocket] Rapid wind: ${data.wind_avg} m/s`);
    },
    onEvent: (event, data) => {
      console.log(`[WebSocket] Event: ${event}`);
      notification?.sendInfo(`Tempest event: ${event}`);
    },
    onError: (error) => {
      console.error('[WebSocket] Error:', error.message);
      notification?.sendError(`WebSocket error: ${error.message}`);
    },
    onConnect: () => {
      console.log('[WebSocket] Connected');
    },
    onDisconnect: () => {
      console.log('[WebSocket] Disconnected');
    },
  });
}
