const assert = require('assert');
const { _buildRecurrence, normalizeDateOnly } = require('../services/eventService');

function run() {
  // recurrence build
  assert.strictEqual(_buildRecurrence(null), undefined, 'null recurrence');
  const r = _buildRecurrence({ frequency: 'DAILY', interval:2, byDay:['MO','TU','WE'] });
  assert.strictEqual(r.frequency, 'DAILY');
  assert.strictEqual(r.interval, 2);
  assert.deepStrictEqual(r.byDay, ['MO','TU','WE']);
  console.log('eventService.test OK');
}

if (require.main === module) run();
module.exports = run;
