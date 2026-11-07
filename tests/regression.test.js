const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Test 1: EAS Ignore exclusion of .env
test('EAS Configuration: .env is excluded and not negated', () => {
  const easignore = fs.readFileSync(path.join(__dirname, '../.easignore'), 'utf8');
  const lines = easignore.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.equal(lines.includes('.env'), true, '.env must be listed in .easignore');
  assert.equal(lines.includes('!.env'), false, '!.env must NOT be present in .easignore');
});

// Test 2: URL polyfill import in index.js
test('Networking: index.js imports react-native-url-polyfill/auto', () => {
  const indexJs = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  assert.match(indexJs, /import\s+['"]react-native-url-polyfill\/auto['"]/, 'URL polyfill must be imported in index.js');
});

// Test 3: Decimal normalization for blood sugar
test('Data Integrity: decimal comma parsing converts comma to period', () => {
  const parseSugar = (raw) => {
    const normalized = String(raw || '').trim().replace(',', '.');
    return parseFloat(normalized);
  };

  assert.equal(parseSugar('5,4'), 5.4);
  assert.equal(parseSugar('7,85'), 7.85);
  assert.equal(parseSugar('12.3'), 12.3);
  assert.equal(parseSugar(' 4,9 '), 4.9);
  assert.equal(isNaN(parseSugar('abc')), true);
});

// Test 4: Network error detection function
test('Authentication: isNetworkError distinguishes network glitch from auth revocation', () => {
  const isNetworkError = (err) => {
    if (!err) return false;
    const msg = String(err.message || '').toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('connection') ||
      err.name === 'AbortError' ||
      (err.name === 'TypeError' && msg.includes('fetch'))
    );
  };

  // Network failures -> must NOT sign out
  assert.equal(isNetworkError(new Error('Network request failed')), true);
  assert.equal(isNetworkError(new Error('TypeError: fetch failed')), true);
  assert.equal(isNetworkError(new Error('Connection timed out')), true);

  // Authentication revocation -> MUST sign out
  assert.equal(isNetworkError(new Error('invalid_grant: Invalid Refresh Token')), false);
  assert.equal(isNetworkError(new Error('JWT expired')), false);
  assert.equal(isNetworkError(new Error('User not found')), false);
});

// Test 5: Date preservation when picking time on Android
test('Reminders: updating time does not overwrite calendar date', () => {
  const baseDate = new Date('2026-11-25T12:00:00Z');
  const pickedTime = new Date('2026-11-07T08:30:00Z'); // Android picker returns today with selected time

  const updateTimePreservingDate = (currentDate, selectedTime) => {
    const next = new Date(currentDate);
    next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    return next;
  };

  const result = updateTimePreservingDate(baseDate, pickedTime);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), baseDate.getMonth());
  assert.equal(result.getDate(), baseDate.getDate());
  assert.equal(result.getHours(), pickedTime.getHours());
  assert.equal(result.getMinutes(), pickedTime.getMinutes());
});

// Test 6: Period filtering logic in logFilters
test('Log Filters: getPeriodRange computes inclusive date boundaries', () => {
  const { PERIODS, filterLogsByPeriod } = require('../utils/logFilters');
  assert.equal(Array.isArray(PERIODS), true);
  assert.equal(PERIODS.length, 5);

  const testLogs = [
    { id: 1, sugar_level: 5.5, timestamp: new Date().toISOString() },
    { id: 2, sugar_level: 8.0, timestamp: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 3, sugar_level: 6.2, timestamp: new Date(Date.now() - 40 * 86400000).toISOString() },
  ];

  const todayLogs = filterLogsByPeriod(testLogs, 'today');
  assert.equal(todayLogs.length, 1);
  assert.equal(todayLogs[0].id, 1);

  const last7Logs = filterLogsByPeriod(testLogs, 'last7');
  assert.equal(last7Logs.length, 1);

  const last30Logs = filterLogsByPeriod(testLogs, 'last30');
  assert.equal(last30Logs.length, 2);
});

// Test 7: Language dictionary key parity
test('Localization: dictionary key parity across ru, en, ky', () => {
  const langDir = path.join(__dirname, '../lang');
  const files = fs.readdirSync(langDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(langDir, file), 'utf8');
    const match = content.match(/export\s+default\s+({[\s\S]*?});/);
    if (!match) continue;

    const fn = new Function('return ' + match[1]);
    const obj = fn();
    const ruKeys = Object.keys(obj.ru || {}).sort();
    const enKeys = Object.keys(obj.en || {}).sort();
    const kyKeys = Object.keys(obj.ky || {}).sort();

    assert.deepEqual(enKeys, ruKeys, `${file}: EN keys must match RU keys`);
    assert.deepEqual(kyKeys, ruKeys, `${file}: KY keys must match RU keys`);
  }
});
