/**
 * Streaming Service
 * Manages real-time weather data streaming via WebSocket
 * Falls back to polling if WebSocket fails
 */

import { createWebSocketClient, TempestWebSocketClient } from './tempest-websocket';
import { pollWeatherData } from './queue';
import { NotificationService } from '../notification/interface';
import { config } from '../config/env';

/**
 * Streaming mode configuration
 */
export type StreamingMode = 'websocket' | 'polling' | 'auto';

/**
 * Streaming statistics
 */
export interface StreamingStats {
  mode: StreamingMode;
  connected: boolean;
  observationsReceived: number;
  rapidWindUpdates: number;
  eventsReceived: number;
  errorsCount: number;
  uptimeSeconds: number;
  lastObservationTime?: Date;
}

/**
 * Streaming service state
 */
interface StreamingState {
  mode: StreamingMode;
  wsClient: TempestWebSocketClient | null;
  pollTimer: NodeJS.Timeout | null;
  startTime: Date;
  stats: StreamingStats;
}

const state: StreamingState = {
  mode: config.STREAMING_MODE as StreamingMode || 'auto',
  wsClient: null,
  pollTimer: null,
  startTime: new Date(),
  stats: {
    mode: config.STREAMING_MODE as StreamingMode || 'auto',
    connected: false,
    observationsReceived: 0,
    rapidWindUpdates: 0,
    eventsReceived: 0,
    errorsCount: 0,
    uptimeSeconds: 0,
  },
};

/**
 * Update statistics
 */
function updateStats(type: 'observation' | 'rapid_wind' | 'event' | 'error'): void {
  switch (type) {
    case 'observation':
      state.stats.observationsReceived++;
      state.stats.lastObservationTime = new Date();
      break;
    case 'rapid_wind':
      state.stats.rapidWindUpdates++;
      break;
    case 'event':
      state.stats.eventsReceived++;
      break;
    case 'error':
      state.stats.errorsCount++;
      break;
  }

  // Update uptime
  state.stats.uptimeSeconds = Math.floor(
    (Date.now() - state.startTime.getTime()) / 1000
  );
}

/**
 * Start streaming service
 * Uses WebSocket in primary mode, falls back to polling if needed
 */
export async function startStreamingService(
  notification: NotificationService
): Promise<void> {
  console.log('='.repeat(60));
  console.log('Starting Weather Chain Streaming Service');
  console.log('='.repeat(60));

  const stations = await (await import('./tempest')).getStations();

  if (stations.length === 0) {
    throw new Error('No stations found. Check TEMPEST_API_KEY configuration.');
  }

  console.log(`Found ${stations.length} station(s)`);

  const stationId = stations[0]; // Primary station

  // Determine mode
  const mode = state.mode === 'auto' ? 'websocket' : state.mode;

  if (mode === 'websocket') {
    console.log('Mode: WebSocket (real-time)');
    await startWebSocketMode(stationId, notification);
  } else {
    console.log('Mode: Polling (fallback)');
    startPollingMode(notification);
  }

  console.log('='.repeat(60));
}

/**
 * Start WebSocket streaming mode
 */
async function startWebSocketMode(
  stationId: number,
  notification: NotificationService
): Promise<void> {
  console.log('Initializing WebSocket client...');

  // Import WebSocket module dynamically
  const WebSocket = require('ws');

  // Update WebSocket client to use local module
  // Need to modify the tempest-websocket to import from 'ws' properly
  state.wsClient = createWebSocketClient(stationId, notification);

  // Set up observation handler to queue data
  // This would integrate with the existing queue system
  const originalOnObservation = (state.wsClient as any).options?.onObservation;

  // Wrap the observation handler to queue data
  (state.wsClient as any).options = {
    ...(state.wsClient as any).options,
    onObservation: async (data: any) => {
      updateStats('observation');

      // Queue the observation for blockchain processing
      const { WeatherRecord } = await import('../db/models/weather-record');

      await WeatherRecord.create({
        stationId: data.station_id || stationId,
        timestamp: new Date(data.timestamp || new Date()),
        data,
        status: 'pending',
        source: 'websocket',
        createdAt: new Date(),
      });

      console.log(`[Stream] Queued observation: ${data.timestamp}`);

      // Call original handler if it exists
      if (originalOnObservation) {
        originalOnObservation(data);
      }
    },
    onRapidWind: (data: any) => {
      updateStats('rapid_wind');
      // Optional: queue rapid wind updates
      console.log(`[Stream] Rapid wind update: ${data.wind_avg} m/s`);
    },
    onEvent: (event: string, data: any) => {
      updateStats('event');
      // Optional: queue events (lightning strikes, precipitation)
      console.log(`[Stream] Event: ${event}`);
    },
    onError: (error: Error) => {
      updateStats('error');
      console.error('[Stream] WebSocket error:', error.message);

      // Fall back to polling after multiple errors
      if (state.stats.errorsCount > 5 && state.mode !== 'polling') {
        console.log('[Stream] Too many errors, falling back to polling...');
        stopStreamingService();
        state.mode = 'polling';
        startPollingMode(notification);
      }
    },
    onConnect: () => {
      state.stats.connected = true;
      console.log('[Stream] ✓ WebSocket connected');
      notification?.sendInfo('WebSocket streaming active');
    },
    onDisconnect: () => {
      state.stats.connected = false;
      console.log('[Stream] WebSocket disconnected');
    },
  };

  // Connect to WebSocket
  (state.wsClient as any).connect();
}

/**
 * Start polling fallback mode
 */
function startPollingMode(notification: NotificationService): void {
  console.log('Starting polling fallback mode...');
  state.mode = 'polling';

  // Run immediately
  pollWeatherData(notification).catch((error) => {
    console.error('Initial poll failed:', error);
  });

  // Then run at intervals
  state.pollTimer = setInterval(async () => {
    try {
      await pollWeatherData(notification);
    } catch (error) {
      console.error('Polling loop error:', error);
    }
  }, config.POLL_RATE * 1000);

  console.log(`Polling at ${config.POLL_RATE}s intervals`);
}

/**
 * Stop streaming service
 */
export function stopStreamingService(): void {
  console.log('Stopping streaming service...');

  // Stop WebSocket
  if (state.wsClient) {
    state.wsClient.disconnect();
    state.wsClient = null;
  }

  // Stop polling
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  console.log('✓ Streaming service stopped');
}

/**
 * Get streaming statistics
 */
export function getStreamingStats(): StreamingStats {
  // Update uptime
  state.stats.uptimeSeconds = Math.floor(
    (Date.now() - state.startTime.getTime()) / 1000
  );

  return { ...state.stats };
}

/**
 * Switch streaming mode
 */
export function switchStreamingMode(mode: StreamingMode): void {
  console.log(`Switching mode: ${state.mode} -> ${mode}`);
  state.mode = mode;
  state.stats.mode = mode;
}

/**
 * Get current mode
 */
export function getStreamingMode(): StreamingMode {
  return state.mode;
}
