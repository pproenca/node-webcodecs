const assert = require('assert');
const {VideoColorSpace} = require('../dist/index.js');

console.log('Testing VideoColorSpace enum values...');

// Test all VideoColorPrimaries values
const primariesValues = ['bt709', 'bt470bg', 'smpte170m', 'bt2020', 'smpte432'];
for (const p of primariesValues) {
  const cs = new VideoColorSpace({primaries: p});
  assert.strictEqual(cs.primaries, p, `primaries should accept ${p}`);
}

// Test all VideoTransferCharacteristics values
const transferValues = [
  'bt709',
  'smpte170m',
  'iec61966-2-1',
  'linear',
  'pq',
  'hlg',
];
for (const t of transferValues) {
  const cs = new VideoColorSpace({transfer: t});
  assert.strictEqual(cs.transfer, t, `transfer should accept ${t}`);
}

// Test all VideoMatrixCoefficients values
const matrixValues = ['rgb', 'bt709', 'bt470bg', 'smpte170m', 'bt2020-ncl'];
for (const m of matrixValues) {
  const cs = new VideoColorSpace({matrix: m});
  assert.strictEqual(cs.matrix, m, `matrix should accept ${m}`);
}

// Test fullRange
const csFullRange = new VideoColorSpace({fullRange: true});
assert.strictEqual(csFullRange.fullRange, true);

const csLimitedRange = new VideoColorSpace({fullRange: false});
assert.strictEqual(csLimitedRange.fullRange, false);

// Test toJSON round-trip
const fullCs = new VideoColorSpace({
  primaries: 'bt2020',
  transfer: 'pq',
  matrix: 'bt2020-ncl',
  fullRange: false,
});
const json = fullCs.toJSON();
assert.strictEqual(json.primaries, 'bt2020');
assert.strictEqual(json.transfer, 'pq');
assert.strictEqual(json.matrix, 'bt2020-ncl');
assert.strictEqual(json.fullRange, false);

console.log('All VideoColorSpace tests passed!');
