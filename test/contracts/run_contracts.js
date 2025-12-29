/**
 * API Contract Test Runner
 *
 * Recursively finds and runs all contract test files in test/contracts/
 * Mirrors the pattern from test/suite.js for consistency.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function findTests(dir, tests = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findTests(fullPath, tests);
        } else if (entry.name.endsWith('.js') && entry.name !== 'run_contracts.js') {
            tests.push(fullPath);
        }
    }
    return tests.sort();
}

const contractsDir = __dirname;
const tests = findTests(contractsDir);

if (tests.length === 0) {
    console.log('No contract tests found.');
    process.exit(0);
}

console.log('Running API Contract Tests\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const testPath of tests) {
    const relativePath = path.relative(contractsDir, testPath);
    console.log(`\n>>> ${relativePath}`);
    console.log('-'.repeat(60));

    try {
        execSync(`node "${testPath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '../..'),
            timeout: 60000
        });
        passed++;
        console.log(`<<< ${relativePath}: PASSED`);
    } catch (e) {
        failed++;
        console.log(`<<< ${relativePath}: FAILED`);
    }
}

console.log('\n' + '='.repeat(60));
console.log(`\nContract Tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
