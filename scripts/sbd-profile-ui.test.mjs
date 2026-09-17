import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../weight-class-explorer.html', import.meta.url), 'utf8');

test('radar has integrated scale references and consistent axis labels', () => {
  assert.doesNotMatch(source, /ringLabels\s*=|sbd-profile-ring-label[^>]*>P/);
  assert.doesNotMatch(source, /SCALE · P0–P100/);
  assert.doesNotMatch(source, /sbd-profile-scale-badge|scale badge/i);
  assert.doesNotMatch(source, /ZOOMED VIEW/);
  assert.doesNotMatch(source, /sbd-profile-scale-caption|Outer ring: P\$\{scale\.maximum\}/);
  assert.match(source, /class="sbd-profile-guide-label is-p\$\{value\}/);
  assert.match(source, /pointAt\(-90, value \/ scale\.maximum\)/);
  assert.match(source, /reservedLabelBoxes = \[/);
  assert.match(source, /const radius = 100/);
  assert.doesNotMatch(source, /sbd-profile-guide-label[^>]*>P0/);
  assert.match(source, /class="sbd-profile-point-label"/);
  assert.match(source, /sbd-profile-point-label \{ fill:var\(--accent\); font:700 20px/);
  assert.match(source, /sbd-profile-guide-label \{ fill:var\(--text-muted\); font:600 12px/);
  assert.match(source, /const isMaximum = value === scale\.maximum/);
  assert.match(source, /const labelX = isMaximum \? point\.x \+ 9/);
  assert.match(source, /class="sbd-profile-scale-dot/);
  assert.match(source, /class="sbd-profile-endpoint"/);
  assert.match(source, /class="sbd-profile-axis-name"/);
  assert.match(source, /font:700 15px var\(--font-display\)/);
  assert.match(source, /svg\.innerHTML = `\$\{rings\}\$\{axes\}\$\{endpoints\}/);
  assert.match(source, /pointAt\(-90, value \/ scale\.maximum\)/);
  assert.doesNotMatch(source, /<span>\$\{sbdProfileDisplay\(item\.score\)\}<\/span>/);
});

test('accessible chart description includes scale and all three lift values', () => {
  assert.match(source, /outer ring represents P\$\{scale\.maximum\}/);
  assert.match(source, /Exact percentile values remain unchanged/);
  assert.match(source, /Squat \$\{sbdProfileDisplay\(scores\[0\]\.score\)\}/);
  assert.match(source, /bench press \$\{sbdProfileDisplay\(scores\[1\]\.score\)\}/);
  assert.match(source, /deadlift \$\{sbdProfileDisplay\(scores\[2\]\.score\)\}/);
  assert.doesNotMatch(source, /<title id="sbdProfile/);
  assert.match(source, /aria-labelledby="sbdChartTitle" aria-describedby="sbdChartDescription"/);
});

test('profile rows and radar points are static presentation', () => {
  assert.doesNotMatch(source, /sbd-profile-lift[^>]*>.*?<button/i);
  assert.doesNotMatch(source, /sbd-profile-point"[^>]*(?:tabindex|role="button")/i);
  assert.doesNotMatch(source, /data-sbd-profile-detail/);
  assert.match(source, /sbdProfileAccessibleSummary/);
});

test('page-level sections use shared heading classes and profile stays nested', () => {
  assert.ok((source.match(/class="[^"]*section-eyebrow/g) || []).length >= 4);
  assert.ok((source.match(/class="section-title/g) || []).length >= 5);
  assert.match(source, /class="profile-card-title"/);
});

test('major result sections each have one section-scoped feedback control', () => {
  const ids = [...source.matchAll(/data-section-feedback="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['score_snapshot', 'historical_benchmark', 'weight_class_scenario', 'standards_comparison', 'scenario_lab']);
  assert.equal((source.match(/data-section-response="yes"/g) || []).length, 4);
  assert.equal((source.match(/data-section-response="no"/g) || []).length, 4);
  assert.match(source, /group\.dataset\.sectionFeedback/);
  assert.match(source, /Thanks for your feedback\./);
});
