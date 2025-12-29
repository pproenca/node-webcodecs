const { execSync } = require('child_process');
const path = require('path');

const tests = [
    '01_smoke.js',
    '02_config.js',
    '03_frame.js',
    '04_encoding.js'
];

console.log('Running WebCodecs Node.js Test Suite\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const test of tests) {
    const testPath = path.join(__dirname, test);
    console.log(`\nRunning ${test}...`);
    console.log('-'.repeat(50));

    try {
        execSync(`node "${testPath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        passed++;
    } catch (e) {
        failed++;
        console.log(`FAILED: ${test}`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}
