import en from '../locales/en.json';
import ur from '../locales/ur.json';

/** Flatten to dotted keys; plural forms (_one/_other/…) count as the same key. */
function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k.replace(/_(zero|one|two|few|many|other)$/, '')}`],
  );
}

describe('locales', () => {
  it('ur has no keys that en lacks (missing ur keys fall back to English)', () => {
    const e = new Set(keys(en));
    const u = new Set(keys(ur));
    expect([...u].filter((k) => !e.has(k))).toEqual([]);
  });

  it('no empty strings', () => {
    const empty = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? empty(v as Record<string, unknown>, `${p}${k}.`) : v === '' ? [`${p}${k}`] : []));
    expect([...empty(en), ...empty(ur)]).toEqual([]);
  });
});

declare const __dirname: string;
const __filename_dir = () => __dirname;

describe('strings used in code', () => {
  it('every literal t("…") key exists in en.json', () => {
    // Node built-ins (the app tsconfig has no @types/node, so type just what we use).
    type Dirent = { name: string; isDirectory(): boolean };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Dirent[]; readFileSync(f: string, e: 'utf8'): string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as { join(...p: string[]): string; relative(a: string, b: string): string };
    const root = path.join(__filename_dir(), '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {
          if (f.name !== '__tests__') walk(p);
        } else if (/\.tsx?$/.test(f.name)) files.push(p);
      }
    };
    walk(root);
    const known = new Set(keys(en));
    const missing = new Set<string>();
    let checked = 0;
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
        checked++;
        if (!known.has(m[1])) missing.add(`${m[1]}  (${path.relative(root, file)})`);
      }
    }
    expect(checked).toBeGreaterThan(100); // the scan really found the t() calls
    expect([...missing]).toEqual([]);
  });
});
