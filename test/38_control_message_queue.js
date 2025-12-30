'use strict';

const assert = require('assert');

// Test control message queue ordering and async execution
console.log('[TEST] Control message queue infrastructure');

const {ControlMessageQueue} = require('../dist/control-message-queue');

async function testQueueOrdering() {
  const results = [];
  const queue = new ControlMessageQueue();

  // Enqueue messages that record execution order
  queue.enqueue(() => {
    results.push('first');
    return Promise.resolve();
  });
  queue.enqueue(() => {
    results.push('second');
    return Promise.resolve();
  });
  queue.enqueue(() => {
    results.push('third');
    return Promise.resolve();
  });

  // Wait for all to process
  await queue.flush();

  assert.deepStrictEqual(
    results,
    ['first', 'second', 'third'],
    'Messages should execute in FIFO order',
  );
  console.log('[PASS] Queue maintains FIFO order');
}

async function testAsyncExecution() {
  const queue = new ControlMessageQueue();
  let executed = false;

  queue.enqueue(async () => {
    await new Promise(r => setTimeout(r, 10));
    executed = true;
  });

  // Should not block
  assert.strictEqual(executed, false, 'Should not execute synchronously');

  await queue.flush();
  assert.strictEqual(executed, true, 'Should execute after flush');
  console.log('[PASS] Messages execute asynchronously');
}

async function testErrorHandling() {
  const queue = new ControlMessageQueue();
  let errorCaught = false;

  queue.setErrorHandler(err => {
    errorCaught = true;
    console.log(`[EXPECTED ERROR] ${err.message}`);
  });

  queue.enqueue(() => {
    throw new Error('Test error');
  });

  await queue.flush();
  assert.strictEqual(errorCaught, true, 'Error handler should be called');
  console.log('[PASS] Error handling works');
}

(async () => {
  await testQueueOrdering();
  await testAsyncExecution();
  await testErrorHandling();
  console.log('[PASS] Control message queue infrastructure verified');
})().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
