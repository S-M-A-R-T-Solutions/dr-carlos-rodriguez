import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Run after `npm run build`: verify the actual markup delivered to browsers.
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const images = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) =>
  Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])),
);

function image(src) {
  const matches = images.filter((img) => img.src === src);
  assert.equal(matches.length, 1, `Expected one image at ${src}`);
  return matches[0];
}

test('hero remains eager and gets priority rather than competing with distant content', () => {
  const hero = image('/images/hero-image.webp');
  assert.equal(hero.loading, 'eager');
  assert.equal(hero.fetchpriority, 'high');
  assert.equal(hero.width, '1024');
  assert.equal(hero.height, '1024');
  assert.equal(images.filter((img) => img.fetchpriority === 'high').length, 1);
});

test('all 13 below-hero portrait, clinic and insurance images defer loading and reserve their intrinsic ratio', () => {
  const expected = new Map([
    ['/images/dr-carlos-ok.webp', ['1080', '1350']],
    ...[1, 2, 3].map((n) => [`/images/clinic-${n}.webp`, ['1200', '800']]),
    ...['aetna', 'amerihealth-caritas', 'anthem-blue-cross-blue-shield', 'avmed', 'cigna',
      'united-healthcare', 'bright-health', 'molina-healthcare', 'oscar']
      .map((name) => [`/images/insurances/${name}.webp`, ['1200', '800']]),
  ]);
  assert.equal(expected.size, 13);
  for (const [src, [width, height]] of expected) {
    const img = image(src);
    assert.equal(img.loading, 'lazy', src);
    assert.equal(img.decoding, 'async', src);
    assert.equal(img.width, width, src);
    assert.equal(img.height, height, src);
    assert.ok(img.alt, `Alternative text must remain for ${src}`);
  }
});

test('all 12 service images keep their existing lazy-loading behavior', () => {
  const serviceImages = images.filter((img) => img.class?.includes('h-52'));
  assert.equal(serviceImages.length, 12);
  for (const img of serviceImages) assert.equal(img.loading, 'lazy', img.src);
});
