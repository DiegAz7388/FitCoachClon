// Ejecutar: npx tsx ai.test.ts  (o deno run ai.test.ts)
declare const process: { exit(code: number): never };
// — prueba los proveedores con respuestas simuladas (sin red).
import { AiError, geminiTuning, generatePlanWithAI, parseJsonText, fallbackOrder, pickFlashModel, rankFlashModels, resetModelCache, retry } from './ai.ts';
retry.delaysMs = [1]; // igual que producción: un reintento
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

const calls: { url: string; body: any; headers: any; retried?: boolean }[] = [];
let mode = 'ok';
let available = ['gemini-3.5-flash', 'gemini-3.5-pro'];
let saturated: string[] = []; let slow: string[] = []; let limited: string[] = [];
const fake = (async (url: string, init: RequestInit = {}) => {
  calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null, headers: init.headers, hasSignal: Boolean(init.signal) } as any);
  if (String(url).includes('/models?')) {
    if (mode === 'bad-key') return new Response('API key not valid', { status: 400 });
    return new Response(JSON.stringify({ models: available.map((n) => m(n)) }), { status: 200 });
  }
  if (String(url).includes('openai')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }), { status: 200 });
  const model = String(url).match(/models\/([^:]+):/)?.[1];
  if (!available.includes(model!)) return new Response('model not found', { status: 404 });
  if (saturated.includes(model!)) return new Response('{"error":{"message":"The model is overloaded. Please try again later."}}', { status: 503 });
  if (slow.includes(model!)) { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; }
  if (limited.includes(model!)) return new Response('{"error":{"code":429,"message":"You exceeded your current quota"}}', { status: 429 });
  if (mode === 'reject-schema' && calls.filter((c) => c.url.includes(':generateContent')).length === 1) return new Response('Unknown name "responseJsonSchema"', { status: 400 });
  const lastBody = calls[calls.length - 1].body;
  if (mode === 'reject-thinking' && lastBody?.generationConfig?.thinkingConfig) return new Response('{"error":{"message":"Invalid JSON payload received. Unknown name \\"thinkingLevel\\" at generation_config.thinking_config"}}', { status: 400 });
  if (mode === '429') return new Response('quota', { status: 429 });
  if (mode === 'slow') { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; }
  if (mode === '503-once' && !calls.some((c) => c.retried)) { calls[calls.length - 1].retried = true; return new Response('{"error":{"message":"The model is overloaded"}}', { status: 503 }); }
  if (mode === '503') return new Response('{"error":{"message":"The model is overloaded"}}', { status: 503 });
  if (mode === '403') return new Response('{"error":{"code":403,"message":"Generative Language API has not been used in project 123 before or it is disabled."}}', { status: 403 });
  return gem(JSON.stringify(plan));
}) as typeof fetch;

(async () => {
let r = await generatePlanWithAI('sys', 'prompt', env({ GEMINI_API_KEY: 'k1' }), fake);
const gen = () => calls.filter((c) => c.url.includes(':generateContent'));
assert(r.name === 'P' && calls[0].url.includes('/models?') && gen()[0].url.includes('/models/gemini-3.5-flash:generateContent'), 'sin GEMINI_MODEL descubre y usa el Flash disponible');
assert(gen()[0].headers['x-goog-api-key'] === 'k1' && !gen()[0].url.includes('k1'), 'clave en encabezado (no en la URL)');
assert(calls.every((c: any) => c.hasSignal), 'todas las llamadas a Google tienen límite de tiempo');
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

assert(JSON.stringify(geminiTuning('gemini-3.8-flash')) === '{"thinkingConfig":{"thinkingLevel":"low"}}' && !('temperature' in geminiTuning('gemini-3.8-flash')), 'Gemini 3: razonamiento "low" y temperatura por defecto');
assert(geminiTuning('gemini-flash-latest').thinkingConfig && geminiTuning('gemini-2.5-flash').temperature === 0.7, 'alias latest con "low"; Gemini 2.x conserva su temperatura');
calls.length = 0; mode = 'ok'; available = ['gemini-3.8-flash'];
await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' }), fake);
assert(gen()[0].body.generationConfig.thinkingConfig?.thinkingLevel === 'low' && !('temperature' in gen()[0].body.generationConfig), 'la petición a Gemini 3 pide razonamiento "low"');
calls.length = 0; mode = 'reject-thinking';
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' }), fake);
assert(r.name === 'P' && gen().length === 2 && !gen()[1].body.generationConfig.thinkingConfig && gen()[1].body.generationConfig.responseJsonSchema, 'si el modelo no acepta el ajuste, reintenta sin él (conservando el esquema)');

calls.length = 0; mode = '503-once';
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' }), fake);
assert(r.name === 'P' && gen().length === 2, 'si Gemini está saturado (503) reintenta y funciona');
for (const [md, status, re] of [['503', 503, /saturado/], ['403', 500, /has not been used in project/]] as const) {
  calls.length = 0; mode = md; let e2: unknown;
  try { await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' }), fake); } catch (e) { e2 = e; }
  assert(e2 instanceof AiError && e2.status === status && re.test((e2 as Error).message), `${md}: muestra la causa real → ${(e2 as Error).message}`);
}

calls.length = 0; mode = 'slow'; let slowErr: unknown;
try { await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.8-flash' }), fake); } catch (e) { slowErr = e; }
assert(slowErr instanceof AiError && slowErr.status === 504 && /tardó demasiado/.test((slowErr as Error).message), 'si Gemini no contesta a tiempo, error claro (504)');

assert(rankFlashModels([m('gemini-3.8-flash'), m('gemini-3.5-flash'), m('gemini-flash-latest'), m('gemini-3.8-flash-lite'), m('gemini-3.9-flash-preview-11-2026')]).join() === 'gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest,gemini-3.9-flash-preview-11-2026,gemini-3.8-flash-lite', 'ordena los modelos Flash de respaldo');

// Respaldo entre modelos cuando el principal está saturado o no responde
mode = 'ok'; available = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.8-flash-lite'];
const reset = async () => { calls.length = 0; resetModelCache(); };
await reset(); saturated = ['gemini-3.8-flash'];
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2' }), fake);
const used = () => gen().map((c) => c.url.match(/models\/([^:]+):/)![1]);
assert(r.name === 'P' && used().at(-1) === 'gemini-3.8-flash-lite', 'si el principal está saturado (503), usa un Flash-Lite: ' + used().join(' → '));

await reset(); saturated = []; slow = ['gemini-3.8-flash'];
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2' }), fake);
assert(r.name === 'P' && used().join() === 'gemini-3.8-flash,gemini-3.8-flash-lite', 'si el principal no responde a tiempo, usa el siguiente (Flash-Lite)');

await reset(); slow = []; saturated = ['gemini-3.8-flash'];
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2', GEMINI_MODEL: 'gemini-3.8-flash' }), fake);
assert(r.name === 'P' && used().at(-1) === 'gemini-3.8-flash-lite', 'también con GEMINI_MODEL configurado, cambia a otro si está saturado');

await reset(); saturated = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.8-flash-lite']; let allErr: unknown;
try { await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2' }), fake); } catch (e) { allErr = e; }
assert(allErr instanceof AiError && allErr.status === 503 && new Set(used()).size === 3, 'si los 3 modelos están saturados, avisa que intente más tarde (prueba 3 modelos)');
assert(fallbackOrder(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.8-flash-lite']).slice(0, 3).join() === 'gemini-3.8-flash,gemini-3.8-flash-lite,gemini-3.7-flash', 'respaldo: Flash, luego Flash-Lite, luego otro Flash (caso de los registros)');

await reset(); saturated = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.8-flash-lite'];
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2', OPENAI_API_KEY: 'sk' }), fake);
assert(r.name === 'P' && calls.at(-1)!.url.includes('openai'), 'con ambas claves, si Gemini está saturado responde OpenAI');
await reset(); saturated = [];
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2', OPENAI_API_KEY: 'sk' }), fake);
assert(r.name === 'P' && !calls.some((c) => c.url.includes('openai')), 'con ambas claves, si Gemini responde no se usa OpenAI');
await reset(); saturated = []; limited = ['gemini-3.8-flash'];
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2' }), fake);
assert(r.name === 'P' && used().join() === 'gemini-3.8-flash,gemini-3.8-flash-lite', 'si un modelo llegó a su límite (429), usa otro sin reintentar el mismo');
await reset(); limited = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.8-flash-lite']; let quotaErr: unknown;
try { await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2' }), fake); } catch (e) { quotaErr = e; }
assert(quotaErr instanceof AiError && quotaErr.status === 429 && /límite de uso/.test((quotaErr as Error).message), 'si todos llegaron al límite, avisa del límite: ' + (quotaErr as Error).message);
await reset();
r = await generatePlanWithAI('s', 'p', env({ GEMINI_API_KEY: 'k2', OPENAI_API_KEY: 'sk' }), fake);
assert(r.name === 'P' && calls.at(-1)!.url.includes('openai'), 'con límite agotado en Gemini y clave de OpenAI, responde OpenAI');
limited = [];
saturated = []; slow = [];

calls.length = 0; mode = 'ok';
r = await generatePlanWithAI('s', 'p', env({ OPENAI_API_KEY: 'sk' }), fake);
assert(r.name === 'P' && calls[0].url.includes('openai'), 'sin Gemini usa OpenAI');
let err: unknown; try { await generatePlanWithAI('s', 'p', env({}), fake); } catch (e) { err = e; }
assert(err instanceof AiError && /GEMINI_API_KEY/.test((err as Error).message), 'sin claves avisa qué secreto falta');
})().catch((e) => { console.error(e); process.exit(1); });
