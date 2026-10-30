import { expect, it } from 'vitest';
import { CHUNK_SIZE, chunkString, generatePin } from './syncTransport';

it('splits a payload into chunks that join back exactly', () => {
  const payload = 'x'.repeat(CHUNK_SIZE * 2 + 17);
  const chunks = chunkString(payload);
  expect(chunks).toHaveLength(3);
  expect(chunks.join('')).toBe(payload);
  expect(chunkString('')).toEqual(['']);
});

it('makes 6-digit PINs', () => {
  for (let i = 0; i < 50; i++) expect(generatePin()).toMatch(/^\d{6}$/);
});
