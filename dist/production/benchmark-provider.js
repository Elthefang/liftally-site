(function () {
  const DATA_URL = 'data/benchmark_percentiles_v2.json';
  const LIFT_DATA_URL = 'data/benchmark_lift_percentiles_v1.json';
  const STANDARD_MAP = {
    ipf: ['IPF'],
    usapl: ['USAPL'],
    uspa: ['USPA', 'IPL'],
    wrpf: ['WRPF']
  };
  const SEX_MAP = {
    men: 'M',
    women: 'F'
  };
  const AUTO_TESTED_ORDER = {
    ipf: ['tested', 'unknown', 'untested'],
    usapl: ['tested', 'unknown', 'untested'],
    uspa: ['unknown', 'tested', 'untested'],
    wrpf: ['unknown', 'tested', 'untested']
  };

  let loadPromise = null;
  let indexed = null;
  let liftLoadPromise = null;
  let liftIndexed = null;

  function normalizeClass(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/kg$/i, '').trim();
  }

  function indexKey(standard, sex, testedStatus, weightClass, scoreType) {
    return [standard, sex, testedStatus, normalizeClass(weightClass), scoreType].join('|');
  }

  async function loadData() {
    if (indexed) return indexed;
    if (!loadPromise) {
      loadPromise = fetch(DATA_URL, { cache: 'force-cache' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Benchmark data request failed with ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          indexed = buildIndex(data);
          return indexed;
        })
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }
    return loadPromise;
  }

  function buildIndex(data) {
    const index = new Map();
    const records = Array.isArray(data.benchmarks) ? data.benchmarks : [];

    records.forEach((record) => {
      const key = indexKey(
        record.benchmarkStandard,
        record.sex,
        record.testedStatus,
        record.weightClass && record.weightClass.normalizedValue,
        record.scoreType
      );
      const list = index.get(key) || [];
      list.push(record);
      index.set(key, list);
    });

    index.forEach((list) => {
      list.sort((a, b) => Number(b.sampleSize || 0) - Number(a.sampleSize || 0));
    });

    return {
      raw: data,
      index,
      source: data.source || {},
      disclaimer: data.disclaimer || ''
    };
  }

  function buildLiftIndex(data) {
    if (!data || data.schemaVersion !== '1.0.0' || !data.groups || typeof data.groups !== 'object') {
      throw new Error('Invalid individual-lift benchmark dataset schema.');
    }
    const index = new Map();
    Object.values(data.groups).forEach((group) => {
      if (!group || !group.weightClass || !group.lifts) return;
      ['squat_kg', 'bench_kg', 'deadlift_kg'].forEach((lift) => {
        const key = indexKey(group.benchmarkStandard, group.sex, group.testedStatus, group.weightClass.normalizedValue, lift);
        const list = index.get(key) || [];
        list.push({ group, lift: group.lifts[lift] || { status: 'unavailable' } });
        index.set(key, list);
      });
    });
    index.forEach((list) => list.sort((a, b) => Number(b.lift.sampleSize || 0) - Number(a.lift.sampleSize || 0)));
    return { raw: data, index, source: data.source || {}, scope: data.scope || {} };
  }

  async function loadLiftData() {
    if (liftIndexed) return liftIndexed;
    if (!liftLoadPromise) {
      liftLoadPromise = fetch(LIFT_DATA_URL, { cache: 'force-cache' })
        .then((response) => {
          if (!response.ok) throw new Error(`Individual-lift benchmark request failed with ${response.status}`);
          return response.json();
        })
        .then((data) => {
          liftIndexed = buildLiftIndex(data);
          return liftIndexed;
        })
        .catch((error) => {
          liftLoadPromise = null;
          throw error;
        });
    }
    return liftLoadPromise;
  }

  function statusOrder(standardKey, requestedStatus) {
    if (requestedStatus && requestedStatus !== 'auto') return [requestedStatus];
    return AUTO_TESTED_ORDER[standardKey] || ['tested', 'unknown', 'untested'];
  }

  function findRecord(store, input, scoreType) {
    const standardCandidates = STANDARD_MAP[input.standardKey] || [];
    const sex = SEX_MAP[input.sex] || input.sex;
    const weightClass = normalizeClass(input.weightClass);
    const testedStatuses = statusOrder(input.standardKey, input.testedStatus || 'auto');

    for (const testedStatus of testedStatuses) {
      const candidates = [];
      standardCandidates.forEach((standard) => {
        const key = indexKey(standard, sex, testedStatus, weightClass, scoreType);
        const list = store.index.get(key);
        if (list && list.length) candidates.push(...list);
      });
      if (candidates.length) {
        candidates.sort((a, b) => Number(b.sampleSize || 0) - Number(a.sampleSize || 0));
        return candidates[0];
      }
    }

    return null;
  }

  function findLiftRecord(store, input, lift) {
    const standardCandidates = STANDARD_MAP[input.standardKey] || [];
    const sex = SEX_MAP[input.sex] || input.sex;
    const weightClass = normalizeClass(input.weightClass);
    const testedStatuses = statusOrder(input.standardKey, input.testedStatus || 'auto');
    for (const testedStatus of testedStatuses) {
      const candidates = [];
      standardCandidates.forEach((standard) => {
        const list = store.index.get(indexKey(standard, sex, testedStatus, weightClass, lift));
        if (list) candidates.push(...list);
      });
      if (candidates.length) {
        candidates.sort((a, b) => Number(b.lift.sampleSize || 0) - Number(a.lift.sampleSize || 0));
        return candidates[0];
      }
    }
    return null;
  }

  function percentileFor(value, percentiles) {
    if (!Number.isFinite(value) || !percentiles) return null;
    let current = null;
    for (let point = 1; point <= 99; point += 1) {
      const threshold = Number(percentiles[String(point)]);
      if (!Number.isFinite(threshold)) continue;
      if (value >= threshold) {
        current = point;
      } else {
        break;
      }
    }
    return current;
  }

  function nextBenchmark(value, percentiles) {
    if (!Number.isFinite(value) || !percentiles) return null;
    for (let point = 1; point <= 99; point += 1) {
      const threshold = Number(percentiles[String(point)]);
      if (Number.isFinite(threshold) && threshold > value) {
        return {
          percentile: point,
          threshold,
          gap: Math.max(0, threshold - value)
        };
      }
    }
    return null;
  }

  function milestoneThresholds(percentiles) {
    return {
      p50: Number(percentiles['50']),
      p75: Number(percentiles['75']),
      p90: Number(percentiles['90']),
      p95: Number(percentiles['95']),
      p99: Number(percentiles['99'])
    };
  }

  function scoreContext(value, record) {
    if (!record || !Number.isFinite(value)) {
      return { status: 'unavailable' };
    }
    const percentile = percentileFor(value, record.percentiles);
    return {
      status: 'ready',
      value,
      percentile,
      percentileLabel: percentile ? `Around P${percentile}` : 'Below P1',
      nextBenchmark: nextBenchmark(value, record.percentiles),
      thresholds: milestoneThresholds(record.percentiles),
      sampleSize: record.sampleSize,
      testedStatus: record.testedStatus,
      benchmarkStandard: record.benchmarkStandard,
      weightClass: record.weightClass && record.weightClass.normalizedValue
    };
  }

  function matchContext(record) {
    if (!record) return null;
    return {
      benchmarkStandard: record.benchmarkStandard,
      sourceFederation: record.sourceFederation,
      parentFederation: record.parentFederation,
      sex: record.sex,
      testedStatus: record.testedStatus,
      weightClass: record.weightClass && record.weightClass.normalizedValue,
      sampleSize: record.sampleSize,
      rowsBeforeDedup: record.rowsBeforeDedup
    };
  }

  async function getBenchmarkContext(input) {
    try {
      const store = await loadData();
      const totalRecord = findRecord(store, input, 'total_kg');
      const dotsRecord = findRecord(store, input, 'dots');
      const primaryRecord = totalRecord || dotsRecord;

      if (!primaryRecord) {
        return {
          status: 'unavailable',
          reason: 'No matching benchmark group for this standard, sex, class, and tested status.',
          source: store.source,
          disclaimer: store.disclaimer
        };
      }

      return {
        status: 'ready',
        source: store.source,
        disclaimer: store.disclaimer,
        match: matchContext(primaryRecord),
        total: scoreContext(Number(input.totalKg), totalRecord),
        dots: scoreContext(Number(input.dots), dotsRecord)
      };
    } catch (error) {
      return {
        status: 'fetch_error',
        reason: 'Benchmark data could not be loaded.',
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  async function getBenchmarkThreshold(input) {
    try {
      const store = await loadData();
      const record = findRecord(store, input, input.scoreType || 'total_kg');
      const percentile = Number(input.percentile);
      if (!record || !Number.isInteger(percentile) || percentile < 1 || percentile > 99) {
        return {
          status: 'unavailable',
          reason: 'No matching benchmark threshold is available.',
          source: store.source,
          disclaimer: store.disclaimer
        };
      }

      const threshold = Number(record.percentiles && record.percentiles[String(percentile)]);
      if (!Number.isFinite(threshold)) {
        return {
          status: 'unavailable',
          reason: 'Requested percentile threshold is unavailable.',
          source: store.source,
          disclaimer: store.disclaimer
        };
      }

      return {
        status: 'ready',
        percentile,
        threshold,
        source: store.source,
        disclaimer: store.disclaimer,
        match: matchContext(record)
      };
    } catch (error) {
      return {
        status: 'fetch_error',
        reason: 'Benchmark data could not be loaded.',
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  function liftScoreContext(value, record, input, sourceGroupKey) {
    const requestedStatus = input.testedStatus && input.testedStatus !== 'auto' ? input.testedStatus : 'unknown';
    const baseResult = {
      metric: input.metric,
      enteredValueKg: value,
      benchmarkGroupKey: sourceGroupKey,
      testedStatus: requestedStatus
    };
    if (!Number.isFinite(value) || value <= 0) return { ...baseResult, status: 'invalid_input', percentile: null, percentileLabel: null, sampleSize: null, rowsBeforeDedup: null };
    if (!record || !record.lift || record.lift.status !== 'ready') return { ...baseResult, status: 'unavailable', percentile: null, percentileLabel: null, sampleSize: null, rowsBeforeDedup: null };
    const score = scoreContext(value, { ...record.lift, testedStatus: record.group.testedStatus, benchmarkStandard: record.group.benchmarkStandard, weightClass: record.group.weightClass });
    if (score.percentile === 99 && value > Number(record.lift.percentiles['99'])) score.percentileLabel = 'P99+';
    return { ...baseResult, ...score, rowsBeforeDedup: record.lift.rowsBeforeDedup, metric: input.metric, enteredValueKg: value, benchmarkGroupKey: sourceGroupKey, testedStatus: record.group.testedStatus };
  }

  async function getLiftBenchmarkContext(input) {
    const lifts = ['squat_kg', 'bench_kg', 'deadlift_kg'];
    const valueKeys = { squat_kg: ['squatKg', 'squat_kg'], bench_kg: ['benchKg', 'bench_kg'], deadlift_kg: ['deadliftKg', 'deadlift_kg'] };
    try {
      const store = await loadLiftData();
      const results = {};
      let matchedGroup = null;
      lifts.forEach((lift) => {
        const record = findLiftRecord(store, input, lift);
        if (record && !matchedGroup) matchedGroup = record.group;
        const group = record && record.group;
        const groupKey = group
          ? [group.benchmarkStandard, group.sourceFederation, group.parentFederation || '', group.sex, group.testedStatus, group.weightClass.normalizedValue, group.period && group.period.key].join('|')
          : null;
        const rawValue = valueKeys[lift].map((key) => input[key]).find((value) => value !== undefined);
        results[lift] = liftScoreContext(Number(rawValue), record, { ...input, metric: lift }, groupKey);
      });
      return {
        status: matchedGroup ? 'ready' : 'unavailable',
        source: store.source,
        match: matchedGroup ? matchContext({ ...matchedGroup, sampleSize: null }) : null,
        ...results
      };
    } catch (error) {
      return { status: 'fetch_error', reason: 'Individual-lift benchmark data could not be loaded.', error: error && error.message ? error.message : String(error) };
    }
  }

  async function getLiftMilestoneContext(input) {
    try {
      const store = await loadLiftData();
      const record = findLiftRecord(store, input, input.metric);
      if (!record || !record.lift || record.lift.status !== 'ready') return { status: 'unavailable' };
      const enteredKg = Number(input.enteredKg);
      if (!Number.isFinite(enteredKg) || enteredKg <= 0) return { status: 'unavailable' };
      const currentLabel = String(input.currentPercentile || '');
      const current = currentLabel === 'Below P1' ? 0 : Number((currentLabel.match(/\d+/) || [input.currentPercentile])[0]);
      const milestones = current <= 0 ? [1] : current >= 99 ? [] : [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99].filter((p) => p > current);
      const next = milestones.map((percentile) => ({ percentile, thresholdKg: Number(record.lift.percentiles[String(percentile)]) })).find((item) => Number.isFinite(item.thresholdKg) && item.thresholdKg > enteredKg);
      return { status: 'ready', metric: input.metric, currentPercentile: input.currentPercentile, nextMilestone: next ? { ...next, deltaKg: next.thresholdKg - enteredKg } : null };
    } catch (error) {
      return { status: 'fetch_error', error: error && error.message ? error.message : String(error) };
    }
  }

  window.benchmarkProvider = {
    getBenchmarkContext,
    getBenchmarkThreshold,
    getLiftBenchmarkContext,
    getLiftMilestoneContext,
    load: loadData,
    loadLiftData
  };
})();
