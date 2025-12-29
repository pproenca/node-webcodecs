const assert = require('assert');
const { VideoFrame } = require('../dist/index.js');

console.log('Test 25: VideoFrame YUV420p format support');

(async () => {
  // YUV420p: Y plane = width*height, U plane = width*height/4, V plane = width*height/4
  const width = 320;
  const height = 240;
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const totalSize = ySize + uvSize + uvSize; // 320*240 + 160*120 + 160*120 = 76800 + 19200 + 19200 = 115200

  const yuvData = new Uint8Array(totalSize);
  // Fill Y plane with gray (128)
  yuvData.fill(128, 0, ySize);
  // Fill U plane with neutral (128)
  yuvData.fill(128, ySize, ySize + uvSize);
  // Fill V plane with neutral (128)
  yuvData.fill(128, ySize + uvSize, totalSize);

  const frame = new VideoFrame(Buffer.from(yuvData.buffer), {
    format: 'I420',
    codedWidth: width,
    codedHeight: height,
    timestamp: 0
  });

  assert.strictEqual(frame.format, 'I420', 'Format should be I420');
  assert.strictEqual(frame.codedWidth, 320, 'Width should be 320');
  assert.strictEqual(frame.codedHeight, 240, 'Height should be 240');

  // Test allocationSize for I420
  const allocSize = frame.allocationSize({ format: 'I420' });
  assert.strictEqual(allocSize, totalSize, `Allocation size should be ${totalSize}`);

  // Test copyTo for I420
  const dest = new Uint8Array(totalSize);
  const layout = await frame.copyTo(dest.buffer, { format: 'I420' });
  assert.strictEqual(layout.length, 3, 'I420 should have 3 planes');
  assert.strictEqual(layout[0].offset, 0, 'Y plane offset should be 0');
  assert.strictEqual(layout[0].stride, width, 'Y plane stride should be width');
  assert.strictEqual(layout[1].offset, ySize, 'U plane offset should be after Y');
  assert.strictEqual(layout[1].stride, width / 2, 'U plane stride should be width/2');
  assert.strictEqual(layout[2].offset, ySize + uvSize, 'V plane offset should be after U');
  assert.strictEqual(layout[2].stride, width / 2, 'V plane stride should be width/2');

  frame.close();
  console.log('PASS');
})();
