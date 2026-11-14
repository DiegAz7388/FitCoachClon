// Ejecutar: npx tsx ai.test.ts  (o deno run ai.test.ts)
declare const process: { exit(code: number): never };
// — prueba los proveedores con respuestas simuladas (sin red).
import { AiError, generatePlanWithAI, parseJsonText, pickFlashModel } from './ai.ts';
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error('FALLÓ: ' + msg); console.log('✔', msg); };
const plan = { name: 'P', summary: 's', days: [{ day_of_week: 1, label: 'Lunes', exercises: [] }] };
const gem = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const env = (vars: Record<string, string>) => (k: string) => vars[k];
const m = (name: string, methods = ['generateContent', 'countTokens']) => ({ name: `models/${name}`, supportedGenerationMethods: methods });

assert(parseJsonText('```json\n' + JSON.stringify(plan) + '\n```').name === 'P', 'quita bloque ```json');
assert(parseJsonText('Aquí está: ' + JSON.stringify(plan) + ' ¡suerte!').days.length === 1, 'extrae JSON rodeado de texto');

// Elección automática de modelo
assert(pickFlashModel([m('gemini-2.0-flash'), m('gemini-3.5-flash'), m('gemini-3.5-flash-lite'), m('gemini-4.0-flash-preview-11-2026'), m('gemini-3.5-pro'), m('text-embedding-005', ['embedContent'])]) === 'gemini-3.5-flash', 'elige el Flash estable más reciente');
assert(pickFlashModel([m('gemini-flash-latest'), m('gemini-3.5-flash-preview-09-2026')]) === 'gemini-flash-latest', 'si no hay estable numerado usa gemini-flash-latest');
assert(pickFlashModel([m('gemini-3.5-flash-preview-09-2026'), m('gemini-3.1-flash-lite')]) === 'gemini-3.5-flash-preview-09-2026', 'luego un Flash preview');
assert(pickFlashModel([m('gemini-3.1-flash-lite'), m('gemini-3.5-pro')]) === 'gemini-3.1-flash-lite', 'por último un Flash-Lite');
assert(pickFlashModel([m('gemini-3.5-flash-image', ['generateContent']), m('gemini-3.5-flash-tts')]) === null, 'ignora variantes de imagen/voz');

const calls: { url: string; body: any; headers: any }[] = [];
let mode = 'ok';
let available = ['gemini-3.5-flash', 'gemini-3.5-pro'];
const fake = (async (url: string, init: RequestInit = {}) => {
  calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null, headers: init.headers });
  if (String(url).includes('/models?')) {
    if (mode === 'bad-key') return new Response('API key not valid', { status: 400 });
    return new Response(JSON.stringify({ models: available.map((n) => m(n)) }), { status: 200 });
  }
  if (String(url).includes('openai')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }), { status: 200 });
  const model = String(url).match(/models\/([^:]+):/)?.[1];
  if (!available.includes(model!)) return new Response('model not found', { status: 404 });
  if (mode === 'reject-schema' && calls.filter((c) => c.url.includes(':generateContent')).length === 1) return new Response('Unknown name "responseJsonSchema"', { status: 400 });
  if (mode === '429') return new Response('quota', { status: 429 });
  return gem(JSON.stringify(plan));
}) as typeof fetch;

(async () => {
let r = await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1' }), fake);
const gen = () => calls.filter((c) => c.url.includes(':generateContent'));
assert(r.name === 'P' && calls[0].url.includes('/models?') && gen()[0].url.includes('/models/gemini-3.5-flash:generateContent'), 'sin GEMINI_MODEL descubre y usa el Flash disponible');
assert(gen()[0].headers['x-goog-api-key'] === 'k1' && !gen()[0].url.includes('k1'), 'clave en encabezado (no en la URL)');
assert(gen()[0].body.generationConfig.responseJsonSchema && gen()[0].body.systemInstruction, 'pide JSON con esquema e instrucciones de sistema');

calls.length = 0;
await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1' }), fake);
assert(!calls.some((c) => c.url.includes('/models?')), 'recuerda el modelo descubierto (no vuelve a listar)');

calls.length = 0; available = ['gemini-4.0-flash'];
r = await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1', GEMINI_MODEL: 'gemini-2.5-flash' }), fake);
assert(r.name === 'P' && gen().length === 2 && gen()[1].url.includes('gemini-4.0-flash'), 'si el modelo configurado fue retirado (404), cambia solo al disponible');

calls.length = 0; available = ['gemini-3.8-flash']; mode = 'reject-schema';
r = await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1', GEMINI_MODEL: 'gemini-3.8-flash' }), fake);
assert(gen().length === 2 && !gen()[1].body.generationConfig.responseJsonSchema && gen()[1].body.contents[0].parts[0].text.includes('JSON Schema'), 'si rechaza el esquema, reintenta con el esquema en el texto (y respeta GEMINI_MODEL)');

for (const [md, status, model] of [['429', 429, 'gemini-3.8-flash'], ['bad-key', 500, '']] as const) {
  calls.length = 0; mode = md; let err: unknown;
  try { await generatePlanWithAI('s', 'p', env(model ? { GEMINI_API_KEY: 'k', GEMINI_MODEL: model } : { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'retirado' }), fake); } catch (e) { err = e; }
  assert(err instanceof AiError && err.status === status, `error claro para ${md}: ${(err as Error).message}`);
}

calls.length = 0; mode = 'ok';
r = await generatePlanWithAI('s', 'p', env({ OPENAI_API_KEY: 'sk' }), fake);
assert(r.name === 'P' && calls[0].url.includes('openai'), 'sin Gemini usa OpenAI');
let err: unknown; try { await generatePlanWithAI('s', 'p', env({}), fake); } catch (e) { err = e; }
assert(err instanceof AiError && /GEMINI_API_KEY/.test((err as Error).message), 'sin claves avisa qué secreto falta');
})().catch((e) => { console.error(e); process.exit(1); });
