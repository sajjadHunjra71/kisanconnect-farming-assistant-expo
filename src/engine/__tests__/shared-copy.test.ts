/** The Edge Functions use copies of some engine files; they must match the app's versions. */
describe('supabase/functions/_shared', () => {
  it('copies are up to date (run `npm run sync-shared`)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readFileSync(p: string, e: 'utf8'): string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FILES, build } = require('../../../scripts/sync-shared.js') as { FILES: string[]; build(root: string, f: string): string };
    const root = `${__dirname}/../../..`;
    for (const f of FILES) {
      expect(fs.readFileSync(`${root}/supabase/functions/_shared/${f}`, 'utf8')).toBe(build(root, f));
    }
  });
});
declare const __dirname: string;
