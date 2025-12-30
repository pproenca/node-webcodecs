const {execSync} = require('child_process');
const path = require('path');

const tests = [
  '01_smoke.js',
  '02_frame_data.js',
  '03_encoding.js',
  '04_leak_check.js',
  '05_render_file.js',
  '06_bitrate_control.js',
  '07_concurrency.js',
  '08_force_keyframe.js',
  '09_robustness.js',
  '10_encoder_reset.js',
  '11_config_supported.js',
  '12_chunk_copyto.js',
  '13_frame_copyto.js',
  '14_ondequeue.js',
  '15_frame_clone.js',
  '16_decoder_basic.js',
  '17_decoder_decode.js',
  '18_decoder_typescript.js',
  '19_audio_data.js',
  '20_encoded_audio_chunk.js',
  '21_audio_encoder_basic.js',
  '22_audio_encoder_encode.js',
  '23_audio_decoder.js',
  '24_audio_typescript.js',
  '28_audio_roundtrip.js',
];

let passed = 0;
let failed = 0;

console.log('Running WebCodecs Validation Protocol Tests\n');
console.log('='.repeat(50));

for (const test of tests) {
  const testPath = path.join(__dirname, test);
  console.log(`\n>>> Running ${test}...`);
  console.log('-'.repeat(50));

  try {
    execSync(`node "${testPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      timeout: 120000,
    });
    passed++;
    console.log(`<<< ${test}: PASSED`);
  } catch (e) {
    failed++;
    console.log(`<<< ${test}: FAILED`);
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
