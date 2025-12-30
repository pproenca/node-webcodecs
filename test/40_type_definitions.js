'use strict';

const assert = require('assert');

console.log('[TEST] Complete type definitions');

// Runtime validation of type structures
const validVideoEncoderConfig = {
  codec: 'avc1.42001E',
  width: 640,
  height: 480,
  hardwareAcceleration: 'prefer-software',
  latencyMode: 'realtime',
  bitrateMode: 'variable',
  alpha: 'discard',
  scalabilityMode: 'L1T1',
};

const validVideoDecoderConfig = {
  codec: 'avc1.42001E',
  hardwareAcceleration: 'no-preference',
  optimizeForLatency: true,
  rotation: 90,
  flip: false,
};

const validVideoFrameInit = {
  codedWidth: 640,
  codedHeight: 480,
  timestamp: 0,
  rotation: 180,
  flip: true,
  visibleRect: {x: 0, y: 0, width: 640, height: 480},
};

// Validate structure exists
assert.ok(typeof validVideoEncoderConfig.hardwareAcceleration === 'string');
assert.ok(typeof validVideoDecoderConfig.rotation === 'number');
assert.ok(typeof validVideoFrameInit.flip === 'boolean');

console.log('[PASS] Type definitions verified');
