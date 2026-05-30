import { connectMongo, disconnectMongo } from './db/connection';
import { getWallet } from './service/wallet';
import { ensureFundingOutputs } from './service/setup';
import { startMonitoringLoop, stopMonitoringLoop } from './service/monitor';
import { getQueueStats } from './service/queue';
import { startProcessorLoop, stopProcessorLoop } from './service/processor';
import { startStreamingService, stopStreamingService, getStreamingStats } from './service/stream';
import { ConsoleNotification } from './notification/console';
import { config, validateConfig } from './config/env';

/**
 * Application state
 */
interface AppState {
  monitorTimer?: NodeJS.Timeout;
  processorTimer?: NodeJS.Timeout;
  streamingStarted: boolean;
  isShuttingDown: boolean;
}

const state: AppState = {
  streamingStarted: false,
  isShuttingDown: false,
};

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Weather Chain - BSV Blockchain Weather Data Service');
  console.log('='.repeat(60));

  // Validate configuration
  console.log('Validating configuration...');
  validateConfig();
  console.log('✓ Configuration valid');

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  await connectMongo();
  console.log('✓ Connected to MongoDB');

  // Initialize wallet
  console.log('Initializing wallet...');
  await getWallet();
  console.log('✓ Wallet initialized');

  // Ensure funding basket
  console.log('Checking funding basket...');
  await ensureFundingOutputs();
  console.log('✓ Funding basket ready');

  console.log('='.repeat(60));
}

/**
 * Start all services
 */
async function startServices(): Promise<void> {
  const notification = new ConsoleNotification();

  console.log('Starting services...');

  // Start monitoring loop
  state.monitorTimer = startMonitoringLoop(notification);

  // Start streaming service (WebSocket with polling fallback)
  await startStreamingService(notification);
  state.streamingStarted = true;

  // Start processor loop
  state.processorTimer = startProcessorLoop(notification);

  console.log('✓ All services started');
  console.log('='.repeat(60));
}

/**
 * Display status information periodically
 */
function startStatusDisplay(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const queueStats = await getQueueStats();
      const streamStats = getStreamingStats();

      const uptimeFormatted = formatUptime(streamStats.uptimeSeconds);
      const modeLabel = streamStats.mode.toUpperCase();
      const connectedStatus = streamStats.connected ? '✓' : '✗';

      console.log(
        `[STATUS] Queue: ${queueStats.pending} pending, ${queueStats.processing} processing, ${queueStats.completed} completed, ${queueStats.failed} failed | ` +
        `Stream (${modeLabel}): ${connectedStatus} | Obs: ${streamStats.observationsReceived} | Uptime: ${uptimeFormatted}`
      );
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  }, 60000); // Every 60 seconds
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  if (state.isShuttingDown) {
    return;
  }

  state.isShuttingDown = true;

  console.log('\n' + '='.repeat(60));
  console.log('Shutting down gracefully...');
  console.log('='.repeat(60));

  // Stop all services
  if (state.monitorTimer) {
    stopMonitoringLoop(state.monitorTimer);
  }

  // Stop streaming service (WebSocket client)
  if (state.streamingStarted) {
    stopStreamingService();
  }

  if (state.processorTimer) {
    stopProcessorLoop(state.processorTimer);
  }

  // Disconnect from MongoDB
  try {
    await disconnectMongo();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }

  console.log('✓ Shutdown complete');
  process.exit(0);
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Initialize
    await initialize();

    // Start services (streaming mode based on STREAMING_MODE config)
    await startServices();

    // Start status display
    const statusTimer = startStatusDisplay();

    // Handle shutdown signals
    process.on('SIGTERM', () => {
      clearInterval(statusTimer);
      shutdown();
    });

    process.on('SIGINT', () => {
      clearInterval(statusTimer);
      shutdown();
    });

    // Handle uncaught errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      shutdown();
    });

    console.log('Application running in streaming mode. Press Ctrl+C to stop.');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, shutdown };
