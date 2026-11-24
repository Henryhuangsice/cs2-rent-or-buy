import { readFileSync } from 'node:fs';
import { run } from '../src/harness.js';
import { openaiCompatible } from '../src/llm.js';
const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url)));
const { LLM_BASE_URL: baseUrl, LLM_API_KEY: apiKey, LLM_MODEL: name } = process.env;
const model = baseUrl && name ? openaiCompatible({ baseUrl, apiKey, model: name }) : null;
const out = await run(process.argv.slice(2).join(' '), { catalog, model });
console.log(out.message, '\n');
for (const t of out.trace) console.log(JSON.stringify(t));
