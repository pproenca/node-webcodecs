import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';

import { buildManifest } from '../../../scripts/ffmpeg-manifest.mjs';

function sha256(value: string): string {
  const hash = createHash('sha256');
  hash.update(value);
  return hash.digest('hex');
}

describe('buildManifest', () => {
  it('includes assets with checksums and variant metadata', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'ffmpeg-manifest-'));
    const artifactPath = join(baseDir, 'ffmpeg-linux-x64.tar.gz');
    writeFileSync(artifactPath, 'fixture');

    const versionsPath = resolve(__dirname, '../../../../ffmpeg/versions.json');
    const manifest = buildManifest({
      artifactsDir: baseDir,
      versionsPath,
      variant: 'gpl',
    });

    assert.strictEqual(manifest.variant, 'gpl');
    assert.strictEqual(manifest.gplEnabled, true);
    assert.ok(manifest.ffmpegVersion);
    assert.strictEqual(manifest.assets.length, 1);
    assert.strictEqual(manifest.assets[0].name, 'ffmpeg-linux-x64.tar.gz');
    assert.strictEqual(manifest.assets[0].sha256, sha256('fixture'));

    rmSync(baseDir, { recursive: true, force: true });
  });
});
