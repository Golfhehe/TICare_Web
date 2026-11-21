/* global process */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MEDIAPIPE_VERSION, WASM_URL } from './constants';

describe('MEDIAPIPE_VERSION', () => {
  it('matches the @mediapipe/tasks-vision version in package-lock.json', () => {
    const lock = JSON.parse(readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'));
    expect(lock.packages['node_modules/@mediapipe/tasks-vision'].version).toBe(MEDIAPIPE_VERSION);
  });
  it('is used in the WASM CDN URL', () => {
    expect(WASM_URL).toContain(`tasks-vision@${MEDIAPIPE_VERSION}/wasm`);
  });
});
