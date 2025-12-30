const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ImageDecoder } = require('../dist/index.js');

console.log('Testing ImageDecoder track support...');

// Valid 1x1 red RGBA PNG
const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
    0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

const decoder = new ImageDecoder({
    type: 'image/png',
    data: pngData
});

// Test tracks property (ImageTrackList per W3C spec)
const tracks = decoder.tracks;
assert(tracks !== null, 'tracks should not be null');
assert(typeof tracks === 'object', 'tracks should be an object');

// Test ImageTrackList.length
assert(typeof tracks.length === 'number', 'tracks.length should be a number');
assert.strictEqual(tracks.length, 1, 'Static image should have exactly 1 track');

// Test ImageTrackList.selectedIndex
assert(typeof tracks.selectedIndex === 'number', 'tracks.selectedIndex should be a number');
assert.strictEqual(tracks.selectedIndex, 0, 'selectedIndex should be 0');

// Test ImageTrackList.selectedTrack (ImageTrack per W3C spec)
assert(tracks.selectedTrack !== null, 'selectedTrack should not be null');
assert(typeof tracks.selectedTrack === 'object', 'selectedTrack should be an object');
assert(typeof tracks.selectedTrack.animated === 'boolean', 'animated should be a boolean');
assert.strictEqual(tracks.selectedTrack.animated, false, 'Static PNG should not be animated');
assert(typeof tracks.selectedTrack.frameCount === 'number', 'frameCount should be a number');
assert.strictEqual(tracks.selectedTrack.frameCount, 1, 'Static image should have 1 frame');
assert(typeof tracks.selectedTrack.repetitionCount === 'number', 'repetitionCount should be a number');
assert.strictEqual(tracks.selectedTrack.repetitionCount, 0, 'Static image should have 0 repetitions');
assert.strictEqual(tracks.selectedTrack.selected, true, 'Track should be selected');

// Test ImageTrackList.ready (should be a Promise)
assert(tracks.ready !== undefined, 'ready property should exist');
assert(typeof tracks.ready.then === 'function', 'ready should be a Promise');

// Test array-like indexing (tracks[0] should work)
assert(tracks[0] !== undefined, 'tracks[0] should be defined');
assert.strictEqual(tracks[0], tracks.selectedTrack, 'tracks[0] should equal selectedTrack');

// Test dimension properties on selectedTrack
assert(typeof tracks.selectedTrack.width === 'number', 'width should be a number');
assert(typeof tracks.selectedTrack.height === 'number', 'height should be a number');
assert.strictEqual(tracks.selectedTrack.width, 1, 'Width should be 1');
assert.strictEqual(tracks.selectedTrack.height, 1, 'Height should be 1');

// Test complete property
assert.strictEqual(decoder.complete, true, 'Static image should be immediately complete');

// Test type property
assert.strictEqual(decoder.type, 'image/png');

decoder.close();
console.log('ImageDecoder track tests passed!');
