/** Edge Functions use a generated copy of src/engine; it must match (run `npm run sync-engine`). */
describe('supabase/functions/_shared/engine', () => {
  it('is an up-to-date copy of src/engine', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readFileSync(p: string, e: 'utf8'): string; readdirSync(d: string): string[] };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { engineFiles, build } = require('../../../scripts/sync-engine.js') as { engineFiles(root: string): string[]; build(root: string, f: string): string };
    const root = `${__dirname}/../../..`;
    const files = engineFiles(root);
    expect(fs.readdirSync(`${root}/supabase/functions/_shared/engine`).sort()).toEqual(files);
    for (const f of files) expect(fs.readFileSync(`${root}/supabase/functions/_shared/engine/${f}`, 'utf8')).toBe(build(root, f));
  });
});
declare const __dirname: string;
