# Phase 2 Benchmark Provider Plan

## Goal

Integrate OpenPowerlifting historical benchmark context into `weight-class-explorer.html` through a provider abstraction.

The UI must call:

```javascript
benchmarkProvider.getBenchmarkContext(input)
```

The UI must not depend on the raw aggregate JSON shape. A future API provider should be able to replace the static JSON provider without rewriting result rendering.

## Provider Input Contract

```javascript
{
  standardKey: "ipf" | "usapl" | "uspa" | "wrpf",
  sex: "men" | "women",
  weightClass: "83" | "83kg" | "140+kg",
  totalKg: 620,
  dots: 410.25,
  testedStatus: "auto" | "tested" | "untested" | "unknown"
}
```

Rules:

- `totalKg` and `dots` are optional independently.
- `testedStatus: "auto"` lets the provider choose a reasonable available group.
- The provider maps website `standardKey` to benchmark standards:
  - `ipf` -> `IPF`
  - `usapl` -> `USAPL`
  - `uspa` -> `USPA`, `IPL`
  - `wrpf` -> `WRPF`
- The combined website `USPA / IPL` selector may return either USPA or IPL context, depending on available data and sample size.

## Provider Output Contract

```javascript
{
  status: "ready" | "loading" | "unavailable" | "insufficient_data" | "fetch_error",
  source: {
    name: "OpenPowerlifting",
    sourceUrl: "https://data.openpowerlifting.org",
    sourceDataAsOf: "2026-05-10",
    generatedAt: "2026-07-30T00:00:00Z",
    attribution: "..."
  },
  disclaimer: "OpenPowerlifting benchmarks are historical public dataset references...",
  match: {
    benchmarkStandard: "USAPL",
    sourceFederation: "USAPL",
    parentFederation: "IPF",
    sex: "M",
    testedStatus: "tested",
    weightClass: "93",
    sampleSize: 4456
  },
  total: {
    status: "ready",
    value: 620,
    percentile: 75,
    percentileLabel: "Around P75",
    nextBenchmark: {
      percentile: 76,
      threshold: 625,
      gap: 5
    },
    thresholds: {
      p50: 562.5,
      p75: 620,
      p90: 672.5,
      p95: 707.5,
      p99: 777.5
    }
  },
  dots: {
    status: "ready",
    value: 400.22,
    percentile: 75,
    percentileLabel: "Around P75",
    nextBenchmark: {
      percentile: 76,
      threshold: 403,
      gap: 2.78
    },
    thresholds: {
      p50: 363.8,
      p75: 400.22,
      p90: 433.51,
      p95: 456.37,
      p99: 500.42
    }
  }
}
```

Unavailable response:

```javascript
{
  status: "unavailable",
  reason: "No matching benchmark group for this standard, sex, class, and tested status."
}
```

Fetch-error response:

```javascript
{
  status: "fetch_error",
  reason: "Benchmark data could not be loaded."
}
```

## Static File Loading Strategy

Phase 2 uses:

```text
data/benchmark_percentiles_v2.json
benchmark-provider.js
```

The static provider:

1. Fetches the JSON on first use.
2. Caches the fetch promise and parsed index in memory.
3. Indexes records by benchmark standard, sex, tested status, weight class, and score type.
4. Returns a backend-ready response object to the UI.
5. Does not expose the raw OpenPowerlifting CSV.

Payload size measured from current Phase 1.1 JSON:

```text
Raw: 4,226,320 bytes / 4.03 MiB
Gzip level 9: 650,306 bytes / 0.62 MiB
```

Brotli was not available locally for measurement.

For development, one static JSON file is acceptable. Before production, if this remains unnecessarily large, split by:

```text
benchmarkStandard + scoreType
```

Example:

```text
data/benchmarks/ipf-total.json
data/benchmarks/ipf-dots.json
data/benchmarks/usapl-total.json
data/benchmarks/usapl-dots.json
```

Continue filtering sex, weight class, and tested status inside the provider.

## Future API Endpoint

Possible future endpoint:

```text
GET /api/benchmarks/context
```

Query params:

```text
standardKey=usapl
sex=men
weightClass=93
testedStatus=tested
totalKg=620
dots=400.22
```

Response shape should match the provider output contract above.

## UI Handling

- `tested`: show benchmark context normally and label it as tested historical dataset context.
- `unknown`: show benchmark context normally but label the status as unknown-tested historical dataset context.
- `untested`: supported by provider, even if the current dataset does not emit any untested records.
- `unavailable`: show a neutral unavailable state.
- `loading`: show a loading state while the static JSON is fetched.
- `fetch_error`: show a non-blocking fetch error and keep calculator results visible.

User-facing copy must use historical benchmark wording, not official ranking wording.

## Files To Modify In Phase 2

```text
weight-class-explorer.html
benchmark-provider.js
data/benchmark_percentiles_v2.json
benchmark-provider-plan.md
```

No Firebase, Cloud Run, login, backend, hosting, deployment, or raw CSV changes are part of Phase 2.
