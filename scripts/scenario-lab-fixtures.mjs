import assert from 'node:assert/strict';

function distributeLiftIncrease(totalIncreaseKg, selectedLifts) {
  const result = { squat: 0, bench: 0, deadlift: 0 };
  const increment = totalIncreaseKg / selectedLifts.length;
  selectedLifts.forEach((lift) => { result[lift] = increment; });
  return result;
}

function displayPercentile(raw) {
  if (raw > 99) return 'P99+';
  return `P${Math.round(raw)}`;
}

function displayedDelta(current, projected) {
  const currentValue = current === 'P99+' ? 99 : Number(current.slice(1));
  const projectedValue = projected === 'P99+' ? 99 : Number(projected.slice(1));
  const delta = projectedValue - currentValue;
  return `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} pts`;
}

assert.deepEqual(distributeLiftIncrease(20, ['squat', 'bench']), { squat: 10, bench: 10, deadlift: 0 });
assert.deepEqual(distributeLiftIncrease(30, ['squat', 'bench', 'deadlift']), { squat: 10, bench: 10, deadlift: 10 });
assert.equal(78 - 3, 75, 'lower-class projection must use the exact official upper boundary');
assert.equal(displayPercentile(41.4), 'P41');
assert.equal(displayPercentile(41.6), 'P42');
assert.equal(displayPercentile(100), 'P99+');
assert.equal(displayedDelta('P41', 'P41'), '+0 pts');
assert.equal(displayedDelta('P42', 'P46'), '+4 pts');

console.log('Scenario Lab fixture tests passed.');
