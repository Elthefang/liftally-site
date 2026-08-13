# Liftally OpenPowerlifting Benchmark Methodology

## 1. Feature Purpose

The OpenPowerlifting benchmark feature provides historical dataset context for the Weight Class Explorer. It is intended to help a lifter understand how an entered SBD Total compares with historical public meet results for a matching competition context.

This feature does not provide official rankings, qualification results, predicted meet placement, or bodyweight-change advice.

Future user-facing insights should be limited to:

- Current historical benchmark percentile or percentile band.
- Next Benchmark Gap to the next available percentile threshold.
- Same-Total Scenario across an adjacent weight class, using the same entered Total as a mathematical comparison only.

## 2. Terminology

Use:

- OpenPowerlifting Benchmark
- Benchmark percentile
- Historical percentile band
- Class-level benchmark
- OpenPowerlifting dataset context
- Same-Total Scenario
- Competition context

Avoid:

- Official ranking
- Global placement
- Qualification result
- Predicted meet result
- Best class
- Better class
- Bodyweight-change recommendation

## 3. Current Local Data Audit

Known preprocessing script:

```text
/Users/yishanfang/Developer/Luke 6-openpowerlifting/Scripts/OpenPowerlifting/generate_benchmark_percentiles.py
```

Known generated aggregate:

```text
/Users/yishanfang/Developer/Luke 6-openpowerlifting/Luke/Resources/OpenPowerlifting/benchmark_percentiles.json
```

Current generated aggregate size:

```text
12 KB
```

Current generated aggregate shape:

- `source`
- `sourceType`
- `sex`
- `equipment`
- `liftType`
- `bucketType`
- `bucketSizeKg`
- `bodyweightBucket`
- `bodyweightMinKg`
- `bodyweightMaxKg`
- `sampleSize`
- `p50`
- `p75`
- `p90`
- `p95`
- `p99`
- `updatedAt`

Current preprocessing limitations:

- Groups by 5 kg bodyweight bucket, 10 kg bodyweight bucket, and all bodyweight.
- Does not group by federation.
- Does not group by event.
- Does not group by age division.
- Does not group by official weight class.
- Does not explicitly filter to SBD for Total benchmarks.
- Does not deduplicate athlete results.
- Does not include P1-P99.
- Does not include methodology version or source-data date.

Raw OpenPowerlifting ZIP found:

```text
/Users/yishanfang/Downloads/openpowerlifting-latest.zip
```

Local ZIP details:

- ZIP size: about 157 MB.
- CSV path inside ZIP: `openpowerlifting-2026-05-16/openpowerlifting-2026-05-16-d230fa1a.csv`.
- CSV uncompressed size: about 794 MB.
- ZIP file timestamp: 2026-05-16.
- Rows scanned: 3,925,887.
- Date range scanned: 1964-09-05 through 2026-05-10.

The official OpenPowerlifting Data Service currently lists nightly bulk downloads at:

```text
https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html
```

At Phase 0 review time, the official service listed:

- Updated: 2026-07-24.
- Revision: 606a59af.
- Complete dataset: `openpowerlifting-latest.zip`, about 161 MB, 3,991,444 rows.

The local ZIP is therefore usable for methodology inspection, but it is not the newest available source snapshot.

## 4. Available Raw Columns

The local CSV includes:

```text
Name, Sex, Event, Equipment, Age, AgeClass, BirthYearClass, Division,
BodyweightKg, WeightClassKg, Squat1Kg, Squat2Kg, Squat3Kg, Squat4Kg,
Best3SquatKg, Bench1Kg, Bench2Kg, Bench3Kg, Bench4Kg, Best3BenchKg,
Deadlift1Kg, Deadlift2Kg, Deadlift3Kg, Deadlift4Kg, Best3DeadliftKg,
TotalKg, Place, Dots, Wilks, Glossbrenner, Goodlift, Tested, Country,
State, Federation, ParentFederation, Date, MeetCountry, MeetState,
MeetTown, MeetName, Sanctioned
```

Relevant scanned value counts:

- `Event`: SBD 2,845,628; B 768,563; D 211,838; BD 73,852; S 19,515; SB 4,157; SD 2,334.
- `Equipment`: Raw 1,847,839; Single-ply 1,387,558; Unlimited 323,512; Wraps 236,411; Multi-ply 130,448; Straps 119.
- `Sex`: M 2,829,220; F 1,096,501; Mx 166.
- `TotalKg`: present 3,659,734; missing 266,153.
- `Dots`: present 3,633,613.
- `Goodlift`: present 3,333,260.
- `Place`: DQ/DD/NS total 266,153.

Target federation row counts using `Federation` or `ParentFederation`:

- IPF: 1,251,531 all rows; 359,205 rows in the most recent five years from the local source date.
- USAPL: 359,563 all rows; 157,911 recent-five-year rows.
- USPA: 226,606 all rows; 105,007 recent-five-year rows.
- WRPF: 91,596 all rows; 52,633 recent-five-year rows.
- IPL: 42,791 all rows; 27,849 recent-five-year rows.

Raw SBD rows with valid Total and Bodyweight for target federations:

- IPF: 573,646.
- USAPL: 247,154.
- IPL: 153,784.
- USPA: 136,926.
- WRPF: 30,637.

## 5. Proposed V2 Scope

Recommended V2 starting scope:

- Event: SBD only.
- Equipment: Raw only.
- Sex: M and F.
- Age division: approved Open-like classes only.
- Federations or standards: IPF, USAPL, USPA, IPL, and WRPF where data quality and sample size are acceptable.
- Primary score: Total.
- Secondary score: DOTS.
- Tested status: group separately as `tested`, `untested`, or `unknown`.
- Minimum sample size: 50 matching results.
- Percentiles: P1-P99 if output size remains acceptable.
- Raw CSV location: private/local/server-side only.
- Public website data: aggregate JSON only.

Do not expand V2 to every equipment type, age division, and federation combination until the initial benchmark behavior is validated.

## 6. Included And Excluded Data

Include a result only when all approved filters pass:

- `Event == "SBD"`.
- `Equipment == "Raw"` for V2.
- `Sex` is `M` or `F`.
- Valid positive `BodyweightKg`.
- Valid positive `TotalKg`.
- Valid `Date`.
- `Place` is not `DQ`, `DD`, or `NS`.
- The result belongs to an approved target federation or standard mapping.
- The result belongs to an approved Open-like division mapping.
- Tested-specific Open labels are included only when `Tested == "Yes"`.
- The result maps to an approved weight-class grouping.

Exclude:

- Bench-only, deadlift-only, squat-only, push-pull, and other non-SBD events for Total benchmarks.
- Missing or invalid Total.
- Missing or invalid bodyweight.
- Disqualified, doping-disqualified, and no-show results.
- Non-Raw equipment in V2.
- Sex categories outside M/F in V2.
- Groups with sample size below 50.
- Results that cannot be mapped confidently to the approved federation, division, and class grouping.
- Tested-specific Open labels with blank, missing, or unexpected `Tested` values.

## 7. Filtering Rules

Recommended filtering order:

1. Parse CSV.
2. Validate required fields.
3. Normalize federation/standard.
4. Normalize sex.
5. Normalize equipment.
6. Normalize event.
7. Normalize age division.
8. Normalize weight class.
9. Exclude invalid or disqualified results.
10. Apply approved athlete-result deduplication.
11. Group and calculate percentiles.

Phase 1 should log counts at each filter stage.

## 8. Federation Mapping Approach

Use both `Federation` and `ParentFederation`.

Recommended initial mapping:

- IPF benchmark: rows where `Federation == "IPF"` or `ParentFederation == "IPF"`.
- USAPL benchmark: rows where `Federation == "USAPL"`.
- USPA benchmark: rows where `Federation == "USPA"`.
- IPL benchmark: rows where `Federation == "IPL"` or `ParentFederation == "IPL"`, excluding rows already mapped to USPA if USPA and IPL are kept separately.
- WRPF benchmark: rows where `Federation == "WRPF"` or `ParentFederation == "WRPF"`.

Owner approval required:

- Whether USPA and IPL should be merged into one `USPA / IPL` benchmark or stored separately with a UI alias.
- Whether IPF should mean only direct `Federation == "IPF"` rows or all `ParentFederation == "IPF"` affiliate rows.
- Whether WRPF parent-affiliate rows should be included despite regional/meet variation.

## 9. Weight-Class Grouping Approach

Two grouping options are viable.

Option A: Use OpenPowerlifting `WeightClassKg`.

- Pros: Reflects the class reported for the actual meet.
- Pros: Handles older and federation-specific classes present in historical data.
- Cons: May include historical classes that no longer match the current Weight Class Explorer UI.
- Cons: Same frontend class may not map cleanly if a federation changed classes over time.

Option B: Recompute class from `BodyweightKg` using the current website class standards.

- Pros: Aligns exactly with the Weight Class Explorer UI.
- Pros: Supports same bodyweight mapped across standards.
- Cons: Reinterprets historical results under the current class structure.
- Cons: May differ from the actual class the lifter competed in.

Recommended V2 approach:

- Use OpenPowerlifting `WeightClassKg` for federation-specific historical benchmark groups.
- Also store normalized `classUpperKg` and `classLabel`.
- For the Same-Total Scenario, compare only adjacent classes within the same approved standard using the generated class groups.
- If the selected UI class does not have a matching benchmark group above the sample threshold, return insufficient data.

Owner approval required:

- Confirm whether historical meet class (`WeightClassKg`) or current website class mapping should define the benchmark group.

## 10. Age Division Mapping Approach

OpenPowerlifting `Division` is free-form and highly variable. The local dataset has 5,708 unique `Division` values.

Examples:

- IPF Open-like values include `Open`, `MR-O`, `FR-O`, `M-C-Open`, `F-C-Open`, `M-O`, `F-O`, and `O`.
- USAPL mostly uses `MR-O`, `FR-O`, `M-O`, and `F-O`; exact `Open` is rare.
- USPA uses `Open` heavily.
- WRPF includes `Open`, `Pro Open`, `Amateur Open`, `MR-O`, `FR-O`, and others.

Recommended V2 approach:

- Create an explicit owner-approved allowlist of Open-like division labels per federation.
- Do not infer Junior, Masters, Teen, Sub-Junior, or Novice classes as Open unless explicitly approved.
- Prefer `AgeClass` and `BirthYearClass` for age-related exclusions where appropriate, because the OpenPowerlifting README states that `Division` is free-form and age should not be extracted from it when better age fields are available.

Approved Phase 1.1 division behavior:

- Include `M-C-Open` and `F-C-Open` when `Equipment == "Raw"`.
- Exclude `M-E-Open` and `F-E-Open`.
- Include `Open-DT`, `OpenT`, and `TOpen` only when the source row explicitly has `Tested == "Yes"`.
- Do not infer or overwrite tested status from the division label alone.

Future owner approval is still required for newly discovered Open-like labels that are not in the approved allowlist.

## 10.1 Tested Status Mapping

Phase 1.1 adds `testedStatus` as a benchmark grouping dimension.

Mapping rules:

- `Tested == "Yes"` maps to `tested`.
- Explicit `Tested == "No"` maps to `untested`.
- Blank, missing, or unrecognized values map to `unknown`.

Rules:

- Do not treat blank values as untested.
- Do not infer or overwrite `testedStatus` solely from the division label.
- Never combine tested, untested, and unknown records in the same benchmark group.
- Apply the minimum sample size of 50 separately to each `testedStatus` group.

## 11. Athlete-Result Deduplication Approach

Recommended V2 rule:

- For each grouping period and benchmark group, retain one best valid result per lifter identity by score type.
- For Total benchmarks, retain the highest `TotalKg`.
- For DOTS benchmarks, retain the highest `Dots`.
- Goodlift/IPF GL-equivalent benchmarks are not generated in Phase 1.1.

Potential lifter identity key:

```text
Name + Sex
```

OpenPowerlifting uses `#` suffixes to distinguish lifters who share the same name. This makes `Name` more useful than ordinary raw names, but it is still not a perfect global identity.

Owner approval required:

- Whether to deduplicate by `Name + Sex`, `Name + Sex + Country`, or no deduplication.
- Whether deduplication should happen within each data period only or across all time.
- Whether the same lifter can contribute separately to different equipment or federation groups.

Recommended decision:

- Deduplicate by `Name + Sex` within each exact benchmark group and period.
- Allow the same lifter to appear in separate federations, classes, or periods if the grouping differs.

## 12. Percentile Calculation Method

Recommended method:

- Sort valid numeric values ascending.
- Calculate percentile thresholds with linear interpolation using `rank = pct * (n - 1)`.
- Round output values to two decimals in kg or score units.
- Emit P1-P99 as a percentile map.
- Preserve named milestone thresholds P50, P75, P90, P95, and P99 for UI copy.

Important UI rule:

- If the generated dataset includes only P50/P75/P90/P95/P99, show a band only.
- If the generated dataset includes P1-P99, the UI may show an approximate benchmark percentile, but should still label it as historical dataset context.

## 13. Minimum Sample-Size Rule

Do not display benchmark insight cards for groups with fewer than 50 deduplicated matching results.

For insufficient data, return a structured state:

```json
{
  "status": "insufficient_data",
  "sample_size": 37,
  "minimum_sample_size": 50
}
```

The UI should display neutral copy such as:

```text
Not enough matching historical results for this benchmark context yet.
```

## 14. Treatment Of Missing And Invalid Values

Rules:

- Empty `TotalKg` is invalid for Total benchmarks.
- Empty `BodyweightKg` is invalid for class-level benchmarks.
- Empty `Dots` excludes only DOTS benchmark generation, not Total benchmark generation.
- `Goodlift` is not used in Phase 1.1 benchmark generation.
- Negative attempts do not matter if `Best3*Kg` and `TotalKg` are valid, but Phase 1 should optionally verify that full SBD result fields exist for modern records.
- `Place` values `DQ`, `DD`, and `NS` are invalid.
- Guest lifter value `G` remains open for owner decision. Recommended: include `G` if `TotalKg` is valid because it is a completed meet result but not award eligible.

## 15. Same-Total Scenario Assumptions

Same-Total Scenario compares the user's entered Total against historical benchmark distributions in an adjacent class.

Rules:

- Preserve the exact entered Total.
- Do not change bodyweight.
- Do not predict performance changes.
- Do not recommend entering another class.
- Do not show bodyweight differences or bodyweight-change instructions.
- Only compare adjacent class groups with sample size at or above 50.
- Use wording such as:

```text
At the same assumed Total, this adjacent class maps to a different historical percentile band.
```

Do not use:

```text
If you lose/gain X kg...
```

## 16. Data Freshness And Versioning

Recommended metadata:

- `source`: `OpenPowerlifting`.
- `source_url`: `https://data.openpowerlifting.org` or `https://openpowerlifting.gitlab.io/opl-csv/`.
- `source_revision`: commit/revision from the data service when available.
- `source_data_as_of`: source export date.
- `generated_at`: generation timestamp.
- `methodology_version`: semantic string such as `2.0.0`.
- `minimum_sample_size`: numeric value, initially `50`.

Use deterministic output:

- Stable key sorting.
- Stable percentile ordering.
- Stable floating-point rounding.
- No nondeterministic timestamps if deterministic rebuild checks are needed. If `generated_at` changes, compare generated data excluding metadata.

## 17. License And Attribution

Official sources reviewed:

- OpenPowerlifting Data Service introduction: `https://openpowerlifting.gitlab.io/opl-csv/introduction.html`
- OpenPowerlifting Data Service bulk downloads: `https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html`
- OpenPowerlifting GitLab repository: `https://gitlab.com/openpowerlifting/opl-data`

License summary:

- OpenPowerlifting competition data is contributed to the Public Domain.
- The data service states that all competition data available there is waived of copyright and neighboring rights to the extent possible under law.
- Attribution is not required, but OpenPowerlifting requests attribution when data is incorporated into a project.
- The code is AGPLv3+, but V2 should consume only CSV data and should not copy OpenPowerlifting code.
- Aggregate derived data may be published as a derived use of public-domain factual data, but attribution is still recommended.

Recommended future UI attribution:

```text
Benchmarks use data from the OpenPowerlifting project, https://www.openpowerlifting.org. Data downloads are available at https://data.openpowerlifting.org. Liftally transforms the public dataset into aggregate benchmark percentiles for reference only.
```

Required benchmark disclaimer:

```text
OpenPowerlifting benchmarks are historical public dataset references. They are not official rankings, qualification results, predicted meet placements, or recommendations to change bodyweight.
```

## 18. Proposed V2 Aggregate Schema

Recommended file name:

```text
benchmark_percentiles_v2.json
```

Recommended top-level shape:

```json
{
  "schema_version": "2.0.0",
  "methodology_version": "2.0.0",
  "source": {
    "name": "OpenPowerlifting",
    "source_url": "https://data.openpowerlifting.org",
    "source_revision": "d230fa1a",
    "source_data_as_of": "2026-05-16",
    "generated_at": "2026-07-29T00:00:00Z"
  },
  "minimum_sample_size": 50,
  "benchmarks": [
    {
      "federation": "USAPL",
      "standard_key": "usapl",
      "sex": "M",
      "age_division": "Open",
      "equipment": "Raw",
      "event": "SBD",
      "tested_status": "tested",
      "weight_class": {
        "label": "82.5kg",
        "raw_value": "82.5",
        "upper_kg": 82.5,
        "is_plus_class": false
      },
      "lift_type": "total",
      "score_type": "total_kg",
      "sample_size": 4100,
      "percentiles": {
        "1": 300,
        "50": 535,
        "75": 620,
        "90": 705,
        "95": 760,
        "99": 865
      }
    }
  ]
}
```

Required benchmark fields:

- `federation`: string.
- `standard_key`: string.
- `sex`: `M` or `F`.
- `age_division`: normalized string, initially `Open`.
- `equipment`: normalized string, initially `Raw`.
- `event`: `SBD`.
- `tested_status`: `tested`, `untested`, or `unknown`.
- `weight_class`: object.
- `lift_type`: string, initially `total`.
- `score_type`: `total_kg` or `dots`.
- `sample_size`: integer after deduplication.
- `percentiles`: object keyed by percentile integer string.

Optional benchmark fields:

- `tested_status`: required in Phase 1.1 output.
- `country`: string if a region-specific benchmark is added later.
- `period`: object if all-time and recent-period files are both generated.
- `notes`: array of strings for data caveats.

Null-handling:

- Do not emit benchmark records for missing grouping fields unless a field is explicitly nullable in the schema.
- Use `null` only for optional metadata that is unavailable.
- Do not emit `percentiles` keys where the score value could not be calculated.

Expected grouping key:

```text
standard_key | federation | source_federation | parent_federation | sex | age_division | equipment | event | tested_status | weight_class.raw_value | lift_type | score_type | period
```

Tested, untested, and unknown-tested rows are never combined in the same benchmark group.

Provider compatibility:

The schema should support a local JSON provider and a future API provider behind the same interface:

```javascript
benchmarkProvider.getBenchmarkContext(input)
```

The provider input should include:

- `standardKey`
- `federation`
- `sex`
- `equipment`
- `event`
- `ageDivision`
- `testedStatus`
- `weightClass`
- `totalKg`
- `dots`

The provider output should include:

- Current historical percentile or band.
- Next Benchmark Gap.
- Same-Total Scenario result when available.
- Metadata and disclaimer fields.
- Loading, unavailable, fetch-error, and insufficient-data states.

## 19. Estimated P1-P99 Output Size

Local data scan estimates using target federations, Raw, SBD, valid Total, valid Bodyweight, M/F:

- All-time groups by federation, sex, and OpenPowerlifting `WeightClassKg`: 265 groups.
- All-time groups with sample size at least 50: 181 groups.
- Recent-five-year groups: 213 groups.
- Recent-five-year groups with sample size at least 50: 155 groups.
- Exact `Division == "Open"` all-time groups with sample size at least 50: 96 groups.
- Exact `Division == "Open"` recent-five-year groups with sample size at least 50: 86 groups.

Phase 1.1 emits Total and DOTS records for ten-year, tested-status-separated groups.

```text
1366 benchmark records
```

Generated Phase 1.1 JSON size is `4,226,320` bytes.

## 20. Known Limitations And Data-Quality Risks

- OpenPowerlifting is a historical public dataset, not an official live federation standings database.
- Source coverage varies by federation, date, meet, country, and data contributor.
- `Division` is free-form and cannot be trusted without explicit mapping.
- `WeightClassKg` reflects historical meet classes that may differ from current website standards.
- Federation and parent federation mapping has edge cases.
- Goodlift/IPF GL-equivalent score is intentionally not included in Phase 1.1.
- The local ZIP is older than the latest official service listing.
- Deduplicating by name can merge distinct lifters if the source identity is ambiguous; not deduplicating can overweight frequent competitors.
- All-time benchmarks may overrepresent older eras and changed class systems.
- Recent-five-year benchmarks may have lower sample size in smaller classes and federations.
- WRPF classes vary by region and meet; WRPF benchmark output needs extra disclaimer copy.

## 21. Open Decisions Requiring Owner Approval

Phase 1.1 resolved:

- Use the local 2026-05-16 ZIP.
- Use ten-year data from 2016-05-10 through 2026-05-10.
- Use Raw SBD M/F Open-like divisions.
- Generate Total and DOTS only.
- Group by `testedStatus`.
- Use reported OpenPowerlifting `WeightClassKg`.
- Deduplicate by best score per `Name + Sex` within each group and score type.
- Use minimum sample size 50.
- Emit P1-P99.

Remaining owner decisions before frontend integration:

1. Whether the website should expose `testedStatus` as a visible control or use federation-specific defaults.
2. How to map the website's combined `USPA / IPL` selector to separate `USPA` and `IPL` benchmark standards.
3. Whether to show `unknown` tested-status benchmarks in the UI.
4. Whether to add any newly audited Open-like labels beyond the Phase 1.1 allowlist.
5. Whether Goodlift/IPF GL-equivalent benchmarks should be generated in a later version.

## 22. Phase 1 File Plan After Approval

Expected files to modify:

```text
/Users/yishanfang/Developer/Luke 6-openpowerlifting/Scripts/OpenPowerlifting/generate_benchmark_percentiles.py
```

Expected files to create:

```text
/Users/yishanfang/Developer/Luke 6-openpowerlifting/Scripts/OpenPowerlifting/benchmark_schema_v2.md
/Users/yishanfang/Developer/Luke 6-openpowerlifting/Scripts/OpenPowerlifting/benchmark_validation_report.md
/Users/yishanfang/Developer/Luke 6-openpowerlifting/Luke/Resources/OpenPowerlifting/benchmark_percentiles_v2.json
```

Possible later website files after data approval, not Phase 1 unless explicitly approved:

```text
/Users/yishanfang/liftally-site/data/openpowerlifting-benchmarks-v2.json
/Users/yishanfang/liftally-site/benchmark-provider.js
/Users/yishanfang/liftally-site/weight-class-explorer.html
```

## 23. Recommended Phase 1 Implementation Sequence

1. Confirm owner decisions listed above.
2. Add explicit config constants for target standards, federation mappings, Open-like division allowlists, sample threshold, periods, and score types.
3. Stream-read the raw ZIP or CSV locally.
4. Emit filter-stage counts for auditability.
5. Normalize and validate rows.
6. Apply approved deduplication.
7. Generate P1-P99 plus named milestone thresholds.
8. Skip groups below minimum sample size.
9. Write deterministic `benchmark_percentiles_v2.json`.
10. Generate a validation report with at least ten manually inspected federation/equipment/class combinations.
11. Measure output file size.
12. Stop for owner approval before website integration.
