// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Demuxer } = require('../dist/index.js');

console.log('Test 29: Demuxer basic structure');

// First check if we have a test video file
const testVideoPath = path.join(__dirname, 'fixtures', 'test.mp4');
if (!fs.existsSync(testVideoPath)) {
  console.log('SKIP: No test video file (test/fixtures/test.mp4)');
  process.exit(0);
}

async function testDemuxer() {
  const chunks = [];
  let videoTrack = null;

  const demuxer = new Demuxer({
    onTrack: (track) => {
      console.log(`  Track: ${track.type}, codec: ${track.codec}`);
      if (track.type === 'video') {
        videoTrack = track;
      }
    },
    onChunk: (chunk, trackId) => {
      chunks.push({ chunk, trackId });
    },
    onError: (e) => { throw e; }
  });

  // Open file
  await demuxer.open(testVideoPath);

  assert(videoTrack !== null, 'Should detect video track');
  assert.strictEqual(typeof videoTrack.codec, 'string', 'Track should have codec');
  assert(videoTrack.width > 0, 'Track should have width');
  assert(videoTrack.height > 0, 'Track should have height');

  // Demux all packets
  await demuxer.demux();

  console.log(`  Received ${chunks.length} chunks`);
  assert(chunks.length > 0, 'Should receive chunks');

  // Verify first chunk is keyframe
  assert.strictEqual(chunks[0].chunk.type, 'key', 'First chunk should be keyframe');

  demuxer.close();
  console.log('PASS');
}

testDemuxer().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
