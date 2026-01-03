import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

async function loadResolver() {
  return await import('../../../../scripts/resolve-deps.mjs');
}

describe('resolveDepsFromReleases', () => {
  it('selects latest non-prerelease deps tag for gpl', async () => {
    const releases = [
      {
        tag_name: 'deps-lgpl-v2',
        prerelease: false,
        draft: false,
        published_at: '2025-01-02T10:00:00Z',
        assets: [],
      },
      {
        tag_name: 'deps-v1',
        prerelease: false,
        draft: false,
        published_at: '2025-01-01T10:00:00Z',
        assets: [],
      },
      {
        tag_name: 'deps-v2',
        prerelease: false,
        draft: false,
        published_at: '2025-01-03T10:00:00Z',
        assets: [],
      },
    ];

    const { resolveDepsFromReleases } = await loadResolver();
    const resolved = resolveDepsFromReleases(releases, 'gpl');
    assert.ok(resolved);
    assert.strictEqual(resolved.tag, 'deps-v2');
    assert.strictEqual(resolved.version, 'v2');
    assert.strictEqual(resolved.variant, 'gpl');
  });

  it('selects latest release that satisfies required assets', async () => {
    const releases = [
      {
        tag_name: 'deps-v2',
        prerelease: false,
        draft: false,
        published_at: '2025-01-03T10:00:00Z',
        assets: [{ name: 'ffmpeg-linux-x64.tar.gz' }],
      },
      {
        tag_name: 'deps-v1',
        prerelease: false,
        draft: false,
        published_at: '2025-01-02T10:00:00Z',
        assets: [
          { name: 'ffmpeg-linux-x64.tar.gz' },
          { name: 'ffmpeg-linux-x64-musl.tar.gz' },
          { name: 'ffmpeg-darwin-x64.tar.gz' },
          { name: 'ffmpeg-darwin-arm64.tar.gz' },
        ],
      },
    ];

    const { resolveDepsFromReleases } = await loadResolver();
    const resolved = resolveDepsFromReleases(releases, 'gpl', [
      'linux-x64',
      'linux-x64-musl',
      'darwin-x64',
      'darwin-arm64',
    ]);
    assert.ok(resolved);
    assert.strictEqual(resolved.tag, 'deps-v1');
  });

  it('detects platform assets with legacy glibc naming', async () => {
    const releases = [
      {
        tag_name: 'deps-v3',
        prerelease: false,
        draft: false,
        published_at: '2025-01-03T10:00:00Z',
        assets: [
          { name: 'ffmpeg-linux-x64-glibc.tar.gz' },
          { name: 'ffmpeg-linux-x64-musl.tar.gz' },
          { name: 'ffmpeg-darwin-x64.tar.gz' },
          { name: 'ffmpeg-darwin-arm64.tar.gz' },
        ],
      },
    ];

    const { resolveDepsFromReleases } = await loadResolver();
    const resolved = resolveDepsFromReleases(releases, 'gpl');
    assert.ok(resolved);
    assert.deepStrictEqual(resolved.availability, {
      linux_x64: true,
      linux_x64_musl: true,
      darwin_x64: true,
      darwin_arm64: true,
    });
  });
});
