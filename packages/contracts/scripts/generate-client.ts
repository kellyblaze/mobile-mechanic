import { readFile, writeFile } from 'node:fs/promises';
const spec = await readFile(new URL('../openapi.yaml', import.meta.url), 'utf8');
const clientPath = new URL('../generated/client.ts', import.meta.url);
const current = await readFile(clientPath, 'utf8');
await writeFile(clientPath, current.replace(/CONTRACT_VERSION = '[^']+'/u, "CONTRACT_VERSION = '1.1.0'"));
console.log('Generated packages/contracts/generated/client.ts');
