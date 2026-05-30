/**
 * Coverage Boost — brings statement/line/function coverage above 80% threshold
 *
 * Targets:
 *  - src/config/env.ts: validateConfig() function (0% → ~100%)
 *  - src/scripts/hash-puzzle.ts: createHashPuzzle, createUnlockingScript, verifyHashPuzzle (0% → ~100%)
 *  - src/service/transaction.ts: createWeatherTransactionBatch + mocked wallet path (25% → ~80%)
 *  - src/service/wallet.ts: getWallet() singleton (0% → ~100%)
 */

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SETUP — must come before any imports of the mocked modules
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('../src/service/wallet', () => ({
  getWallet: jest.fn(),
}));

jest.mock('@bsv/wallet-toolbox-client', () => {
  return {
    StorageClient: jest.fn().mockImplementation(() => ({
      makeAvailable: jest.fn().mockResolvedValue(undefined),
    })),
    WalletStorageManager: jest.fn().mockImplementation(() => ({
      identityKey: 'mock-identity-key',
      addWalletStorageProvider: jest.fn().mockResolvedValue(undefined),
    })),
    WalletSigner: jest.fn().mockImplementation(() => ({})),
    Services: jest.fn().mockImplementation(() => ({})),
    Wallet: jest.fn().mockImplementation(() => ({ _isMockWallet: true })),
  };
});

// Mock PrivateKey from @bsv/sdk to avoid "Invalid character" errors when
// SERVER_PRIVATE_KEY env var contains a placeholder value
jest.mock('@bsv/sdk', () => {
  const actual = jest.requireActual('@bsv/sdk');
  return {
    ...actual,
    PrivateKey: jest.fn().mockImplementation(() => ({ toHex: () => 'mock-private-key' })),
    KeyDeriver: jest.fn().mockImplementation(() => ({ identityKey: 'mock-identity-key' })),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. src/config/env.ts — validateConfig()
// ─────────────────────────────────────────────────────────────────────────────

import { validateConfig, config } from '../src/config/env';

/**
 * Temporarily patch config fields, run fn, then restore.
 * This avoids assumptions about what env vars are set in the test runner.
 */
function withConfig(overrides: Record<string, unknown>, fn: () => void): void {
  const original: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(overrides)) {
    original[k] = (config as Record<string, unknown>)[k];
    (config as Record<string, unknown>)[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(original)) {
      (config as Record<string, unknown>)[k] = v;
    }
  }
}

/** Minimum valid config — avoids relying on process.env */
const VALID = {
  TEMPEST_API_KEY: 'test-key',
  MONGO_URI: 'mongodb://localhost/test',
  POLL_RATE: 300,
  FUNDING_OUTPUT_AMOUNT: 1000,
  FUNDING_BASKET_MIN: 200,
  FUNDING_BATCH_SIZE: 1000,
  WEATHER_OUTPUTS_PER_TX: 100,
};

describe('validateConfig()', () => {
  it('should not throw when all values are valid', () => {
    withConfig(VALID, () => {
      expect(() => validateConfig()).not.toThrow();
    });
  });

  it('should throw "Configuration validation failed" prefix on error', () => {
    withConfig({ ...VALID, TEMPEST_API_KEY: '' }, () => {
      expect(() => validateConfig()).toThrow(/^Configuration validation failed/);
    });
  });

  it('should throw when TEMPEST_API_KEY is empty string', () => {
    withConfig({ ...VALID, TEMPEST_API_KEY: '' }, () => {
      expect(() => validateConfig()).toThrow('TEMPEST_API_KEY is required');
    });
  });

  it('should throw when POLL_RATE < 1', () => {
    withConfig({ ...VALID, POLL_RATE: 0 }, () => {
      expect(() => validateConfig()).toThrow('POLL_RATE must be at least 1 second');
    });
  });

  it('should throw when FUNDING_OUTPUT_AMOUNT < 100', () => {
    withConfig({ ...VALID, FUNDING_OUTPUT_AMOUNT: 99 }, () => {
      expect(() => validateConfig()).toThrow('FUNDING_OUTPUT_AMOUNT must be at least 100 satoshis');
    });
  });

  it('should throw when FUNDING_BASKET_MIN < 10', () => {
    withConfig({ ...VALID, FUNDING_BASKET_MIN: 9 }, () => {
      expect(() => validateConfig()).toThrow('FUNDING_BASKET_MIN must be at least 10');
    });
  });

  it('should throw when FUNDING_BATCH_SIZE < 1', () => {
    withConfig({ ...VALID, FUNDING_BATCH_SIZE: 0 }, () => {
      expect(() => validateConfig()).toThrow('FUNDING_BATCH_SIZE must be at least 1');
    });
  });

  it('should throw when WEATHER_OUTPUTS_PER_TX < 1', () => {
    withConfig({ ...VALID, WEATHER_OUTPUTS_PER_TX: 0 }, () => {
      expect(() => validateConfig()).toThrow('WEATHER_OUTPUTS_PER_TX must be between 1 and 100');
    });
  });

  it('should throw when WEATHER_OUTPUTS_PER_TX > 100', () => {
    withConfig({ ...VALID, WEATHER_OUTPUTS_PER_TX: 101 }, () => {
      expect(() => validateConfig()).toThrow('WEATHER_OUTPUTS_PER_TX must be between 1 and 100');
    });
  });

  it('should collect multiple errors and throw them all together', () => {
    withConfig({ ...VALID, TEMPEST_API_KEY: '', POLL_RATE: 0, FUNDING_OUTPUT_AMOUNT: 50 }, () => {
      try {
        validateConfig();
        throw new Error('Expected validateConfig to throw');
      } catch (err: unknown) {
        const msg = (err as Error).message;
        expect(msg).toContain('TEMPEST_API_KEY is required');
        expect(msg).toContain('POLL_RATE must be at least 1 second');
        expect(msg).toContain('FUNDING_OUTPUT_AMOUNT must be at least 100 satoshis');
      }
    });
  });

  it('should throw when MONGO_URI is empty', () => {
    withConfig({ ...VALID, MONGO_URI: '' }, () => {
      expect(() => validateConfig()).toThrow('MONGO_URI is required');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. src/scripts/hash-puzzle.ts
// ─────────────────────────────────────────────────────────────────────────────

import { createHashPuzzle, createUnlockingScript, verifyHashPuzzle } from '../src/scripts/hash-puzzle';

describe('createHashPuzzle()', () => {
  it('should return an object with lockingScript and preimage', () => {
    const puzzle = createHashPuzzle();
    expect(puzzle).toHaveProperty('lockingScript');
    expect(puzzle).toHaveProperty('preimage');
  });

  it('should return lowercase hex strings for both fields', () => {
    const puzzle = createHashPuzzle();
    expect(puzzle.lockingScript).toMatch(/^[0-9a-f]+$/);
    expect(puzzle.preimage).toMatch(/^[0-9a-f]+$/);
  });

  it('should produce a 64-char hex preimage (32 random bytes)', () => {
    const puzzle = createHashPuzzle();
    expect(puzzle.preimage).toHaveLength(64);
  });

  it('should produce unique puzzles on each call', () => {
    const p1 = createHashPuzzle();
    const p2 = createHashPuzzle();
    expect(p1.preimage).not.toBe(p2.preimage);
    expect(p1.lockingScript).not.toBe(p2.lockingScript);
  });

  it('should produce a locking script that verifies against its own preimage', () => {
    const puzzle = createHashPuzzle();
    expect(verifyHashPuzzle(puzzle.lockingScript, puzzle.preimage)).toBe(true);
  });

  it('locking script should be a non-empty hex string', () => {
    const puzzle = createHashPuzzle();
    expect(puzzle.lockingScript.length).toBeGreaterThan(10);
  });
});

describe('createUnlockingScript()', () => {
  it('should prepend "20" to the preimage', () => {
    const preimage = 'abcd1234';
    expect(createUnlockingScript(preimage)).toBe('20abcd1234');
  });

  it('should work with a 64-char (32-byte) preimage', () => {
    const preimage = 'a'.repeat(64);
    const result = createUnlockingScript(preimage);
    expect(result).toBe('20' + 'a'.repeat(64));
    expect(result).toHaveLength(66);
  });

  it('should work with an empty preimage', () => {
    expect(createUnlockingScript('')).toBe('20');
  });

  it('should produce a valid unlocking script for a real hash puzzle', () => {
    const puzzle = createHashPuzzle();
    const unlock = createUnlockingScript(puzzle.preimage);
    expect(unlock).toMatch(/^20[0-9a-f]{64}$/);
  });
});

describe('verifyHashPuzzle()', () => {
  it('should return true for a valid preimage', () => {
    const puzzle = createHashPuzzle();
    expect(verifyHashPuzzle(puzzle.lockingScript, puzzle.preimage)).toBe(true);
  });

  it('should return false for an incorrect preimage', () => {
    const puzzle = createHashPuzzle();
    const wrongPreimage = '00'.repeat(32);
    expect(verifyHashPuzzle(puzzle.lockingScript, wrongPreimage)).toBe(false);
  });

  it('should return false for an empty locking script hex', () => {
    expect(verifyHashPuzzle('', '00'.repeat(32))).toBe(false);
  });

  it('should return false for garbage/malformed locking script', () => {
    // catch block should return false
    expect(verifyHashPuzzle('deadbeef', 'aa'.repeat(32))).toBe(false);
  });

  it('should return false when script has fewer than 3 chunks', () => {
    const { Script, OP } = require('@bsv/sdk');
    const s = new Script();
    s.writeOpCode(OP.OP_SHA256); // only 1 chunk
    expect(verifyHashPuzzle(s.toHex(), 'aa'.repeat(32))).toBe(false);
  });

  it('should return false when the hash chunk has no data', () => {
    // Build a 3-chunk script where chunk[1] has no data field
    const { Script, OP } = require('@bsv/sdk');
    const s = new Script();
    s.writeOpCode(OP.OP_SHA256); // chunk 0
    s.writeOpCode(OP.OP_TRUE);   // chunk 1: opcode only, no .data
    s.writeOpCode(OP.OP_EQUAL);  // chunk 2
    expect(verifyHashPuzzle(s.toHex(), 'aa'.repeat(32))).toBe(false);
  });

  it('should be deterministic — same inputs always give same result', () => {
    const puzzle = createHashPuzzle();
    const result1 = verifyHashPuzzle(puzzle.lockingScript, puzzle.preimage);
    const result2 = verifyHashPuzzle(puzzle.lockingScript, puzzle.preimage);
    expect(result1).toBe(result2);
    expect(result1).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. src/service/transaction.ts — createWeatherTransactionBatch
// ─────────────────────────────────────────────────────────────────────────────

import { createWeatherTransactionBatch } from '../src/service/transaction';
import { getWallet } from '../src/service/wallet';

const mockGetWallet = getWallet as jest.Mock;

function makeRecord(temp = 20): Record<string, unknown> {
  return {
    data: {
      air_temperature: temp,
      air_density: 1.2,
      brightness: 0,
      conditions: 'clear',
      delta_t: 0,
      dew_point: 10,
      feels_like: 20,
      icon: 'clear-day',
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
      pressure_trend: 'steady',
      relative_humidity: 50,
      sea_level_pressure: 1013,
      solar_radiation: 0,
      station_pressure: 1013,
      time: Date.now(),
      uv: 0,
      wet_bulb_globe_temperature: 15,
      wet_bulb_temperature: 14,
      wind_avg: 0,
      wind_direction: 0,
      wind_direction_cardinal: 'N',
      wind_gust: 0,
    },
  };
}

function makeFakeWallet(overrides: Record<string, unknown> = {}) {
  return {
    listOutputs: jest.fn().mockResolvedValue({
      outputs: [
        {
          outpoint: 'abc123:0',
          customInstructions: 'aa'.repeat(32),
        },
      ],
      BEEF: new Uint8Array([1, 2, 3]),
    }),
    createAction: jest.fn().mockResolvedValue({
      txid: 'deadbeef0011223344556677',
    }),
    ...overrides,
  };
}

describe('createWeatherTransactionBatch()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWallet.mockResolvedValue(makeFakeWallet());
  });

  it('should return an empty array when no records are provided', async () => {
    const results = await createWeatherTransactionBatch([]);
    expect(results).toEqual([]);
  });

  it('should process a single record in one transaction', async () => {
    const results = await createWeatherTransactionBatch([makeRecord() as any]);
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('txid', 'deadbeef0011223344556677');
    expect(results[0]).toHaveProperty('outputIndexes');
    expect(results[0].outputIndexes).toEqual([0]);
  });

  it('should split records into batches of the given batchSize', async () => {
    const records = Array.from({ length: 5 }, (_, i) => makeRecord(i));
    // 5 records / batchSize 2 → batches [2, 2, 1] → 3 transactions
    const results = await createWeatherTransactionBatch(records as any[], 2);
    expect(results).toHaveLength(3);
    // getWallet called once per transaction
    expect(mockGetWallet).toHaveBeenCalledTimes(3);
  });

  it('should use default batchSize from config when not specified', async () => {
    // config.WEATHER_OUTPUTS_PER_TX defaults to 100, so 5 records = 1 batch
    const records = Array.from({ length: 5 }, (_, i) => makeRecord(i));
    const results = await createWeatherTransactionBatch(records as any[]);
    expect(results).toHaveLength(1);
  });

  it('should return correct outputIndexes [0..n-1] for each batch', async () => {
    const records = Array.from({ length: 3 }, (_, i) => makeRecord(i));
    const results = await createWeatherTransactionBatch(records as any[], 3);
    expect(results[0].outputIndexes).toEqual([0, 1, 2]);
  });

  it('should propagate errors from createWeatherTransaction', async () => {
    mockGetWallet.mockResolvedValue(
      makeFakeWallet({
        createAction: jest.fn().mockRejectedValue(new Error('BSV network error')),
      })
    );
    await expect(
      createWeatherTransactionBatch([makeRecord() as any])
    ).rejects.toThrow('BSV network error');
  });

  it('should throw when funding outputs list is empty', async () => {
    mockGetWallet.mockResolvedValue(
      makeFakeWallet({
        listOutputs: jest.fn().mockResolvedValue({ outputs: [], BEEF: new Uint8Array([]) }),
      })
    );
    await expect(
      createWeatherTransactionBatch([makeRecord() as any])
    ).rejects.toThrow('No funding outputs available');
  });

  it('should throw when funding output has no preimage (customInstructions is null)', async () => {
    mockGetWallet.mockResolvedValue(
      makeFakeWallet({
        listOutputs: jest.fn().mockResolvedValue({
          outputs: [{ outpoint: 'abc:0', customInstructions: null }],
          BEEF: new Uint8Array([]),
        }),
      })
    );
    await expect(
      createWeatherTransactionBatch([makeRecord() as any])
    ).rejects.toThrow('Funding output missing preimage');
  });

  it('should handle a batch that exactly fills batchSize', async () => {
    const records = Array.from({ length: 4 }, (_, i) => makeRecord(i));
    const results = await createWeatherTransactionBatch(records as any[], 4);
    expect(results).toHaveLength(1);
    expect(results[0].outputIndexes).toEqual([0, 1, 2, 3]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. src/service/wallet.ts — getWallet() singleton
// Uses the top-level jest.mock for @bsv/wallet-toolbox-client
// ─────────────────────────────────────────────────────────────────────────────

// Import wallet module AFTER the mocks are in place
import * as walletService from '../src/service/wallet';

// We need the real (non-mocked) getWallet function for these tests.
// Since jest.mock('../src/service/wallet') is already set above for transaction tests,
// we need a separate describe that bypasses that mock.
// Solution: test the actual wallet internals by importing the actual module directly.
// We'll do this by requiring with jest.requireActual.

describe('getWallet() — real module via requireActual', () => {
  let realGetWallet: () => Promise<unknown>;
  let Wallet: jest.Mock;
  let StorageClient: jest.Mock;
  let WalletStorageManager: jest.Mock;

  beforeAll(() => {
    // Get the mocked constructors from the top-level jest.mock
    const toolbox = require('@bsv/wallet-toolbox-client');
    Wallet = toolbox.Wallet;
    StorageClient = toolbox.StorageClient;
    WalletStorageManager = toolbox.WalletStorageManager;

    // Get the actual wallet module (bypassing the service/wallet mock we set for txn tests)
    realGetWallet = jest.requireActual('../src/service/wallet').getWallet;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call Wallet constructor and return a wallet instance', async () => {
    const wallet = await realGetWallet();
    expect(wallet).toBeDefined();
    expect(Wallet).toHaveBeenCalled();
    expect(StorageClient).toHaveBeenCalled();
    expect(WalletStorageManager).toHaveBeenCalled();
  });

  it('should return same instance on repeated calls (singleton)', async () => {
    // The singleton is module-level; within a single test run, second call returns cached
    const w1 = await realGetWallet();
    const w2 = await realGetWallet();
    expect(w1).toBe(w2);
  });
});
