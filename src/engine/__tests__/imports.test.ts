/** src/engine must stay portable (copied into Deno Edge Functions): relative imports only. */
describe('engine imports', () => {
  it('no @/ alias, no packages, nothing outside src/engine', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readdirSync(d: string): string[]; readFileSync(f: string, e: 'utf8'): string };
    const dir = `${__dirname}/..`;
    const bad: string[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = fs.readFileSync(`${dir}/${f}`, 'utf8');
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
        if (!/^\.\/[\w-]+$/.test(m[1])) bad.push(`${f}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
declare const __dirname: string;
