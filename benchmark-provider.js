(function () {
  const DATA_URL = 'data/benchmark_percentiles_v2.json';
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

  window.benchmarkProvider = {
    getBenchmarkContext,
    getBenchmarkThreshold,
    load: loadData
  };
})();
