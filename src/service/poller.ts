import { config } from '../config/env';
import { getCurrentConditions } from './tempest';
import { insertObservation } from '../db/repo';

/**
 * Live observation poller.
 *
 * On an interval it pulls current conditions from each configured Tempest
 * station and inserts them as 'pending' weather_records (deduped on
 * station_id + observed_at). The existing hash loop then batches those pending
 * records into Merkle-rooted anchors, so the dashboard auto-populates with
 * genuine farm weather and never sits empty.
 *
 * Hash-only behavior is preserved: this only writes pending records; it never
 * touches bsv_txid or anchoring.
 */

/**
 * In-memory record of the last observation epoch (seconds) seen per station.
 * Lets us skip an insert attempt when Tempest hasn't published a newer
 * observation yet. The DB unique index remains the source of truth for dedup.
 */
const lastTimeByStation = new Map<number, number>();

/**
 * Poll a single station: fetch current conditions, derive observedAt and
 * attempt a deduped insert. Errors are swallowed (logged) by the caller's
 * try/catch so one station's failure never affects the others.
 */
async function pollStation(stationId: number): Promise<void> {
  const data = await getCurrentConditions(stationId);

  const obsTime = typeof data.time === 'number' ? data.time : 0;

  // Optimization: if Tempest hasn't advanced the observation time since the
  // last successful poll, don't even attempt the insert (ON CONFLICT would
  // skip it anyway). Only applies when we have a real, non-zero epoch.
  if (obsTime > 0) {
    const prev = lastTimeByStation.get(stationId);
    if (prev !== undefined && obsTime <= prev) {
      console.log(
        `[poller] station ${stationId}: no new observation (time=${obsTime}), skipping`
      );
      return;
    }
  }

  const observedAt = obsTime > 0 ? new Date(obsTime * 1000) : new Date();

  const id = await insertObservation(stationId, observedAt, data);

  if (obsTime > 0) {
    lastTimeByStation.set(stationId, obsTime);
  }

  if (id === null) {
    console.log(`[poller] station ${stationId}: dup-skipped (time=${obsTime})`);
  } else {
    console.log(
      `[poller] station ${stationId}: inserted record id=${id} (time=${obsTime})`
    );
  }
}

/**
 * Run one poll cycle across every configured station. Each station is wrapped
 * in its own try/catch so a single station's failure doesn't stop the others.
 */
async function pollCycle(): Promise<void> {
  for (const stationId of config.TEMPEST_STATION_IDS) {
    try {
      await pollStation(stationId);
    } catch (err) {
      console.error(`[poller] station ${stationId} failed:`, err);
    }
  }
}

/**
 * Start the live poller.
 *
 * Returns the interval timer handle, or null if polling is disabled (no Tempest
 * key or no configured stations). Runs one poll cycle immediately (fired async,
 * never blocking the caller), then on every config.POLL_RATE seconds.
 */
export function startPoller(): NodeJS.Timeout | null {
  if (!config.POLL_ENABLED) {
    console.log('[poller] poller disabled (no Tempest key/stations)');
    return null;
  }

  // Kick off an immediate cycle without blocking the caller.
  pollCycle().catch((err) => {
    console.error('[poller] initial poll cycle failed:', err);
  });

  const timer = setInterval(() => {
    pollCycle().catch((err) => {
      console.error('[poller] poll cycle failed:', err);
    });
  }, config.POLL_RATE * 1000);

  // Don't keep the event loop alive solely for this timer.
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return timer;
}

/**
 * Stop the live poller. Safe to call with null (no-op).
 */
export function stopPoller(timer: NodeJS.Timeout | null): void {
  if (timer) {
    clearInterval(timer);
  }
}
