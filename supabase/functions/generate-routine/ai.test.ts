// Ejecutar: npx tsx ai.test.ts  (o deno run ai.test.ts)
declare const process: { exit(code: number): never };
// — prueba los proveedores con respuestas simuladas (sin red).
import { AiError, generatePlanWithAI, parseJsonText } from './ai.ts';
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error('FALLÓ: ' + msg); console.log('✔', msg); };
const plan = { name: 'P', summary: 's', days: [{ day_of_week: 1, label: 'Lunes', exercises: [] }] };
const gem = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const env = (vars: Record<string, string>) => (k: string) => vars[k];

assert(parseJsonText('```json\n' + JSON.stringify(plan) + '\n```').name === 'P', 'quita bloque ```json');
assert(parseJsonText('Aquí está: ' + JSON.stringify(plan) + ' ¡suerte!').days.length === 1, 'extrae JSON rodeado de texto');

const calls: { url: string; body: any; headers: any }[] = [];
let mode = 'ok';
const fake = (async (url: string, init: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers });
  if (mode === 'reject-schema' && calls.length === 1) return new Response('Unknown name "responseJsonSchema"', { status: 400 });
  if (mode === '429') return new Response('quota', { status: 429 });
  if (mode === '404') return new Response('not found', { status: 404 });
  if (String(url).includes('openai')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }), { status: 200 });
  return gem(JSON.stringify(plan));
}) as typeof fetch;

(async () => {
let r = await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1' }), fake);
assert(r.name === 'P', 'Gemini devuelve la rutina');
assert(calls[0].url.includes('/models/gemini-2.5-flash:generateContent') && calls[0].headers['x-goog-api-key'] === 'k1', 'endpoint, modelo por defecto y clave en encabezado (no en la URL)');
assert(calls[0].body.generationConfig.responseMimeType === 'application/json' && calls[0].body.generationConfig.responseJsonSchema && calls[0].body.systemInstruction, 'pide JSON con esquema e instrucciones de sistema');

calls.length = 0; mode = 'reject-schema';
r = await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1', GEMINI_MODEL: 'gemini-3.8-flash' }), fake);
assert(calls.length === 2 && !calls[1].body.generationConfig.responseJsonSchema && calls[1].body.contents[0].parts[0].text.includes('JSON Schema') && calls[1].url.includes('gemini-3.8-flash'), 'si rechaza el esquema, reintenta con el esquema en el texto (y respeta GEMINI_MODEL)');

for (const [m, status] of [['429', 429], ['404', 500]] as const) {
  calls.length = 0; mode = m; let err: unknown;
  try { await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k' }), fake); } catch (e) { err = e; }
  assert(err instanceof AiError && err.status === status, `error claro para HTTP ${m}: ${(err as Error).message}`);
}

calls.length = 0; mode = 'ok';
r = await generatePlanWithAI('s', 'p', env({ OPENAI_API_KEY: 'sk' }), fake);
assert(r.name === 'P' && calls[0].url.includes('openai'), 'sin Gemini usa OpenAI');
let err: unknown; try { await generatePlanWithAI('s', 'p', env({}), fake); } catch (e) { err = e; }
assert(err instanceof AiError && /GEMINI_API_KEY/.test((err as Error).message), 'sin claves avisa qué secreto falta');
})().catch((e) => { console.error(e); process.exit(1); });
