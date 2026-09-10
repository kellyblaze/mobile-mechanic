import { readFile, writeFile } from 'node:fs/promises';
const spec = await readFile(new URL('../openapi.yaml', import.meta.url), 'utf8');
const clientPath = new URL('../generated/client.ts', import.meta.url);
const current = await readFile(clientPath, 'utf8');
const version = spec.match(/^  version: ([^\r\n]+)/mu)?.[1]?.trim();
if (!version) throw new Error('OpenAPI version is missing.');
await writeFile(clientPath, current.replace(/CONTRACT_VERSION = '[^']+'/u, `CONTRACT_VERSION = '${version}'`));
console.log('Generated packages/contracts/generated/client.ts');
