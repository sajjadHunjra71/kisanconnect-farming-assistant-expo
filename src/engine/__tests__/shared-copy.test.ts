/** The Edge Functions use a copy of weather-rules.ts; it must match the app's version. */
describe('supabase/functions/_shared/weather-rules.ts', () => {
  it('is up to date (run `npm run sync-shared`)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readFileSync(p: string, e: 'utf8'): string };
    const root = `${__dirname}/../../..`;
    const app = fs.readFileSync(`${root}/src/engine/weather-rules.ts`, 'utf8');
    const copy = fs.readFileSync(`${root}/supabase/functions/_shared/weather-rules.ts`, 'utf8');
    expect(copy.split('\n').slice(1).join('\n')).toBe(app);
  });
});
declare const __dirname: string;
