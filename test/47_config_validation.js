'use strict';

const assert = require('assert');
const { VideoEncoder, VideoDecoder } = require('../dist');

console.log('[TEST] Config validation and hardware acceleration');

// Test displayAspect pairing - width without height
function testDisplayAspectValidation() {
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    let threw = false;
    try {
        encoder.configure({
            codec: 'avc1.42001E',
            width: 640,
            height: 480,
            displayAspectWidth: 16
            // Missing displayAspectHeight
        });
    } catch (e) {
        threw = true;
        console.log(`[EXPECTED] ${e.message}`);
    }
    assert.ok(threw, 'Should throw when displayAspectWidth without Height');
    console.log('[PASS] displayAspectWidth without Height throws');

    // Test height without width
    threw = false;
    try {
        encoder.configure({
            codec: 'avc1.42001E',
            width: 640,
            height: 480,
            displayAspectHeight: 9
            // Missing displayAspectWidth
        });
    } catch (e) {
        threw = true;
        console.log(`[EXPECTED] ${e.message}`);
    }
    assert.ok(threw, 'Should throw when displayAspectHeight without Width');
    console.log('[PASS] displayAspectHeight without Width throws');

    // Valid config with both
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        displayAspectWidth: 16,
        displayAspectHeight: 9
    });
    console.log('[PASS] Config with both displayAspect dimensions accepted');

    encoder.close();
}

// Test hardware acceleration hints for encoder
function testEncoderHardwareAcceleration() {
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    // prefer-software
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        hardwareAcceleration: 'prefer-software'
    });
    console.log('[PASS] Encoder accepts prefer-software');

    // prefer-hardware
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        hardwareAcceleration: 'prefer-hardware'
    });
    console.log('[PASS] Encoder accepts prefer-hardware');

    // no-preference (default)
    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480,
        hardwareAcceleration: 'no-preference'
    });
    console.log('[PASS] Encoder accepts no-preference');

    encoder.close();
}

// Test hardware acceleration and optimizeForLatency for decoder
function testDecoderConfig() {
    const decoder = new VideoDecoder({
        output: () => {},
        error: () => {}
    });

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
        hardwareAcceleration: 'prefer-hardware',
        optimizeForLatency: true
    });
    console.log('[PASS] Decoder accepts prefer-hardware + optimizeForLatency');

    decoder.configure({
        codec: 'avc1.42001E',
        codedWidth: 640,
        codedHeight: 480,
        hardwareAcceleration: 'prefer-software',
        optimizeForLatency: false
    });
    console.log('[PASS] Decoder accepts prefer-software + optimizeForLatency=false');

    decoder.close();
}

// Test valid config with no displayAspect (both absent is valid)
function testNoDisplayAspect() {
    const encoder = new VideoEncoder({
        output: () => {},
        error: () => {}
    });

    encoder.configure({
        codec: 'avc1.42001E',
        width: 640,
        height: 480
        // No displayAspect fields at all - valid
    });
    console.log('[PASS] Config without displayAspect is valid');

    encoder.close();
}

// Run all tests
testDisplayAspectValidation();
testEncoderHardwareAcceleration();
testDecoderConfig();
testNoDisplayAspect();

console.log('[PASS] Config validation and hardware acceleration hints work');
