import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const providerSource = await readFile(new URL('../benchmark-provider.js', import.meta.url), 'utf8');
const productionLiftData = JSON.parse(await readFile(new URL('../data/benchmark_lift_percentiles_v1.json', import.meta.url), 'utf8'));
const percentiles = Object.fromEntries(Array.from({ length: 99 }, (_, index) => [String(index + 1), index + 1]));

function group(lifts = {}) {
  return {
    benchmarkStandard: 'USAPL', sourceFederation: 'USAPL', parentFederation: '', sex: 'F', testedStatus: 'tested',
    weightClass: { normalizedValue: '75', label: '75kg' }, period: { key: 'recent_10_years' },
    lifts
  };
}

function ready(n, rows = n + 10) {
  return { status: 'ready', sampleSize: n, rowsBeforeDedup: rows, percentiles };
}

function createProvider({ liftData, totalData = { benchmarks: [] }, rejectLift = false } = {}) {
  const window = {};
  const context = vm.createContext({
    window,
    fetch: async (url) => {
      if (url.includes('benchmark_lift_percentiles')) {
        if (rejectLift) throw new Error('network down');
        return { ok: true, json: async () => liftData };
      }
      return { ok: true, json: async () => totalData };
    }
  });
  vm.runInContext(providerSource, context);
  return window.benchmarkProvider;
}

const baseInput = { standardKey: 'usapl', sex: 'women', weightClass: '75', testedStatus: 'tested' };

test('loads lift dataset and preserves independent metric samples', async () => {
  const provider = createProvider({ liftData: { schemaVersion: '1.0.0', source: {}, groups: { g: group({ squat_kg: ready(50), bench_kg: ready(60), deadlift_kg: ready(70) }) } } });
  const result = await provider.getLiftBenchmarkContext({ ...baseInput, squatKg: 50, benchKg: 60, deadliftKg: 70 });
  assert.equal(result.status, 'ready');
  assert.equal(result.squat_kg.sampleSize, 50);
  assert.equal(result.bench_kg.sampleSize, 60);
  assert.equal(result.deadlift_kg.sampleSize, 70);
  assert.equal(result.squat_kg.rowsBeforeDedup, 60);
});

test('keeps unavailable lift distinct without suppressing other lifts', async () => {
  const provider = createProvider({ liftData: { schemaVersion: '1.0.0', groups: { g: group({ squat_kg: ready(50), bench_kg: { status: 'unavailable' }, deadlift_kg: ready(55) }) } } });
  const result = await provider.getLiftBenchmarkContext({ ...baseInput, squatKg: 50, benchKg: 60, deadliftKg: 55 });
  assert.equal(result.squat_kg.status, 'ready');
  assert.equal(result.bench_kg.status, 'unavailable');
  assert.equal(result.bench_kg.percentile, null);
  assert.equal(result.deadlift_kg.status, 'ready');
});

test('handles percentile boundaries and invalid input', async () => {
  const provider = createProvider({ liftData: { schemaVersion: '1.0.0', groups: { g: group({ squat_kg: ready(50), bench_kg: ready(50), deadlift_kg: ready(50) }) } } });
  const below = await provider.getLiftBenchmarkContext({ ...baseInput, squatKg: 0, benchKg: 0.5, deadliftKg: 50 });
  assert.equal(below.squat_kg.status, 'invalid_input');
  assert.equal(below.bench_kg.percentileLabel, 'Below P1');
  assert.equal(below.deadlift_kg.percentileLabel, 'Around P50');
  const upper = await provider.getLiftBenchmarkContext({ ...baseInput, squatKg: 99, benchKg: 100, deadliftKg: 200 });
  assert.equal(upper.squat_kg.percentileLabel, 'Around P99');
  assert.equal(upper.bench_kg.percentileLabel, 'P99+');
});

test('rejects malformed lift schema and exposes fetch errors distinctly', async () => {
  const malformed = createProvider({ liftData: { schemaVersion: '9.0.0', groups: {} } });
  const bad = await malformed.getLiftBenchmarkContext({ ...baseInput, squatKg: 1, benchKg: 1, deadliftKg: 1 });
  assert.equal(bad.status, 'fetch_error');
  const failing = createProvider({ liftData: {}, rejectLift: true });
  const failed = await failing.getLiftBenchmarkContext({ ...baseInput, squatKg: 1, benchKg: 1, deadliftKg: 1 });
  assert.equal(failed.status, 'fetch_error');
});

test('does not silently fall back when the lift group is missing', async () => {
  const provider = createProvider({ liftData: { schemaVersion: '1.0.0', groups: { g: group() } } });
  const result = await provider.getLiftBenchmarkContext({ ...baseInput, weightClass: '83', squatKg: 100, benchKg: 100, deadliftKg: 100 });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.squat_kg.status, 'unavailable');
});

test('accepts explicit unknown status without falling back to tested data', async () => {
  const unknownGroup = { ...group({ squat_kg: ready(51), bench_kg: ready(52), deadlift_kg: ready(53) }), testedStatus: 'unknown' };
  const provider = createProvider({ liftData: { schemaVersion: '1.0.0', groups: { g: unknownGroup } } });
  const result = await provider.getLiftBenchmarkContext({ ...baseInput, testedStatus: 'unknown', squatKg: 50, benchKg: 50, deadliftKg: 50 });
  assert.equal(result.status, 'ready');
  assert.equal(result.squat_kg.testedStatus, 'unknown');
  assert.equal(result.match.testedStatus, 'unknown');
});

test('preserves existing Total and DOTS provider behavior', async () => {
  const totalRecord = {
    benchmarkStandard: 'USAPL', sourceFederation: 'USAPL', parentFederation: '', sex: 'F', testedStatus: 'tested',
    weightClass: { normalizedValue: '75' }, scoreType: 'total_kg', sampleSize: 80, rowsBeforeDedup: 100, percentiles
  };
  const dotsRecord = { ...totalRecord, scoreType: 'dots', percentiles: Object.fromEntries(Array.from({ length: 99 }, (_, i) => [String(i + 1), (i + 1) / 2])) };
  const provider = createProvider({ liftData: { schemaVersion: '1.0.0', groups: {} }, totalData: { source: {}, benchmarks: [totalRecord, dotsRecord] } });
  const result = await provider.getBenchmarkContext({ ...baseInput, totalKg: 80, dots: 40 });
  assert.equal(result.status, 'ready');
  assert.equal(result.total.percentile, 80);
  assert.equal(result.dots.percentile, 80);
  assert.equal(result.match.sampleSize, 80);
});

test('production dataset smoke test covers sexes, statuses, and class ranges', async () => {
  const groups = Object.values(productionLiftData.groups);
  const selected = [];
  for (const predicate of [
    (g) => ['IPF', 'USAPL', 'WRPF'].includes(g.benchmarkStandard) && g.sex === 'M' && g.testedStatus === 'tested',
    (g) => ['IPF', 'USAPL', 'WRPF'].includes(g.benchmarkStandard) && g.sex === 'F',
    (g) => ['IPF', 'USAPL', 'WRPF'].includes(g.benchmarkStandard) && g.testedStatus === 'unknown',
    (g) => ['IPF', 'USAPL', 'WRPF'].includes(g.benchmarkStandard) && !g.weightClass.isPlusClass && Number(g.weightClass.upperKg) <= 60,
    (g) => ['IPF', 'USAPL', 'WRPF'].includes(g.benchmarkStandard) && !g.weightClass.isPlusClass && Number(g.weightClass.upperKg) >= 80 && Number(g.weightClass.upperKg) <= 90,
    (g) => ['IPF', 'USAPL', 'WRPF'].includes(g.benchmarkStandard) && g.weightClass.isPlusClass
  ]) {
    const found = groups.find((g) => predicate(g) && Object.values(g.lifts).some((lift) => lift.status === 'ready'));
    if (found) selected.push(found);
  }
  assert.equal(selected.length, 6);
  const provider = createProvider({ liftData: productionLiftData });
  for (const sourceGroup of selected) {
    const input = {
      standardKey: sourceGroup.benchmarkStandard === 'IPL' ? 'uspa' : sourceGroup.benchmarkStandard.toLowerCase(), sex: sourceGroup.sex === 'M' ? 'men' : 'women',
      weightClass: sourceGroup.weightClass.normalizedValue, testedStatus: sourceGroup.testedStatus,
      squatKg: sourceGroup.lifts.squat_kg.status === 'ready' ? sourceGroup.lifts.squat_kg.percentiles['50'] : 0,
      benchKg: sourceGroup.lifts.bench_kg.status === 'ready' ? sourceGroup.lifts.bench_kg.percentiles['50'] : 0,
      deadliftKg: sourceGroup.lifts.deadlift_kg.status === 'ready' ? sourceGroup.lifts.deadlift_kg.percentiles['50'] : 0
    };
    const result = await provider.getLiftBenchmarkContext(input);
    assert.equal(result.status, 'ready');
    for (const lift of ['squat_kg', 'bench_kg', 'deadlift_kg']) {
      const candidates = groups.filter((g) =>
        g.benchmarkStandard === sourceGroup.benchmarkStandard && g.sex === sourceGroup.sex &&
        g.testedStatus === sourceGroup.testedStatus && g.weightClass.normalizedValue === sourceGroup.weightClass.normalizedValue &&
        g.lifts[lift].status === 'ready'
      ).sort((a, b) => b.lifts[lift].sampleSize - a.lifts[lift].sampleSize);
      assert.equal(result[lift].sampleSize, candidates.length ? candidates[0].lifts[lift].sampleSize : null);
    }
  }
});
