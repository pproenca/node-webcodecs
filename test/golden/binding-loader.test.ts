import {describe, it, expect} from 'vitest';
import {binding, platformInfo} from '../../lib/binding';

describe('Binding Loader', () => {
  it('loads native binding successfully', () => {
    expect(binding).toBeDefined();
    expect(typeof binding.VideoEncoder).toBe('function');
  });

  it('exports platformInfo', () => {
    expect(platformInfo).toBeDefined();
    expect(platformInfo.platform).toBeDefined();
    expect(platformInfo.arch).toBeDefined();
    expect(typeof platformInfo.nodeVersion).toBe('string');
  });
});
