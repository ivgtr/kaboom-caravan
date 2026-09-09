import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { format, resolveConfig } from 'prettier';

const files = [
  'src/game/simulation/stepSimulation.ts',
  'src/game/simulation/redline.test.ts',
];

describe('prettier diagnostics', () => {
  it('prints canonical formatting for REDLINE files', async () => {
    for (const filepath of files) {
      const source = readFileSync(filepath, 'utf8');
      const config = (await resolveConfig(filepath)) ?? {};
      const formatted = await format(source, { ...config, filepath });
      process.stdout.write(`\n===PRETTIER:${filepath}===\n${formatted}===END:${filepath}===\n`);
    }
  });
});
