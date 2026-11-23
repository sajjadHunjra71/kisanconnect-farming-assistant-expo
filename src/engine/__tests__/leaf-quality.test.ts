import { checkLeafPhoto } from '../leaf-quality';

const W = 64;
function image(fn: (x: number, y: number) => [number, number, number]): Uint8Array {
  const a = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * W + x) * 4;
      a[i] = r;
      a[i + 1] = g;
      a[i + 2] = b;
      a[i + 3] = 255;
    }
  return a;
}

describe('leaf photo quality', () => {
  it('sharp green leaf texture passes', () => {
    const r = checkLeafPhoto(image((x, y) => ((x + y) % 4 < 2 ? [40, 150, 40] : [90, 200, 70])), W, W);
    expect(r.blocks).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.leafRatio).toBe(1);
  });

  it('flat (blurry) image is blocked as blurry', () => {
    const r = checkLeafPhoto(image(() => [80, 160, 60]), W, W);
    expect(r.blocks).toEqual(['blurry']);
  });

  it('dark image is blocked as dark', () => {
    const r = checkLeafPhoto(image((x, y) => ((x + y) % 2 ? [10, 20, 10] : [30, 40, 20])), W, W);
    expect(r.blocks).toEqual(['dark']);
  });

  it('sharp but not leaf-coloured (blue/grey) only warns', () => {
    const r = checkLeafPhoto(image((x, y) => ((x + y) % 4 < 2 ? [40, 60, 200] : [200, 200, 200])), W, W);
    expect(r.blocks).toEqual([]);
    expect(r.warnings).toEqual(['no-leaf']);
  });

  it('brown/yellow (diseased) leaf still counts as leaf tone', () => {
    const r = checkLeafPhoto(image((x, y) => ((x + y) % 4 < 2 ? [150, 100, 40] : [220, 200, 60])), W, W);
    expect(r.warnings).toEqual([]);
  });

  it('rejects a bad buffer', () => {
    expect(() => checkLeafPhoto(new Uint8Array(10), W, W)).toThrow();
  });
});
