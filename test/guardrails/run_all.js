const { execSync } = require('child_process');
const path = require('path');

const TIMEOUT_MS = 300000; // 5 minutes per test

const guardrails = [
    { name: 'Memory Sentinel', file: 'memory_sentinel.js', args: '--expose-gc' },
    { name: 'Event Loop Watchdog', file: 'event_loop_lag.js', args: '' },
    { name: 'Input Fuzzer', file: 'fuzzer.js', args: '' },
    { name: 'Throughput Benchmark', file: 'benchmark.js', args: '' },
];

console.log('Running Guardrail Tests\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const g of guardrails) {
    const testPath = path.join(__dirname, g.file);
    console.log(`\n>>> ${g.name}...`);
    console.log('-'.repeat(50));

    try {
        execSync(`node ${g.args} "${testPath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '../..'),
            timeout: TIMEOUT_MS
        });
        passed++;
        console.log(`<<< ${g.name}: PASSED`);
    } catch (e) {
        failed++;
        console.error(`    Error: ${e.message || 'Unknown error'}`);
        console.log(`<<< ${g.name}: FAILED`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`Guardrails: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
