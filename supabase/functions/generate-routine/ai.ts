// Proveedores de IA para generar la rutina. Se elige por los secretos configurados:
//   GEMINI_API_KEY  → Google Gemini (prioridad; tiene nivel gratuito)
//   OPENAI_API_KEY  → OpenAI
// Modelos opcionales: GEMINI_MODEL, OPENAI_MODEL (por defecto gpt-4.1-mini).
// Sin GEMINI_MODEL se consulta a Google qué modelos tiene la clave y se usa el Flash estable más reciente.
// Si el modelo no existe, está saturado o tarda demasiado, se prueba con el siguiente Flash disponible.
import { PLAN_SCHEMA, type Plan } from './plan.ts';

export class AiError extends Error { constructor(public status: number, message: string) { super(message); } }

type Env = (name: string) => string | undefined;
type Fetch = typeof fetch;

// Extrae el JSON aunque el modelo lo envuelva en ```json … ``` o agregue texto alrededor.
export function parseJsonText(text: string): Plan {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* sigue */ }
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new AiError(502, 'La IA respondió en un formato inesperado. Intenta de nuevo.');
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Límites de tiempo: la función de Supabase corta a los 150 s y el panel/app esperan 120 s.
// Cada modelo tiene hasta generateMs; entre todos los intentos no se pasa de totalMs.
export const timeouts = { listMs: 15_000, generateMs: 45_000, totalMs: 100_000 };
const timedOut = (error: unknown) => error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
const TOO_SLOW = 'La IA tardó demasiado en responder. Intenta de nuevo en un momento.';
const MAX_MODELS = 3; // modelos distintos a probar si el primero está saturado
let discoveredModels: string[] | null = null; // caché mientras la función siga activa
export const resetModelCache = () => { discoveredModels = null; }; // para pruebas

type GeminiModel = { name: string; supportedGenerationMethods?: string[] };

// Modelos Flash de la clave, en orden de preferencia:
// Flash estable (versión más alta primero) > gemini-flash-latest > Flash preview > Flash-Lite > gemini-flash-lite-latest.
export function rankFlashModels(models: GeminiModel[]): string[] {
  const ids = models
    .filter((m) => (m.supportedGenerationMethods ?? ['generateContent']).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  const version = (id: string) => Number(id.match(/^gemini-(\d+(?:\.\d+)?)-/)?.[1] ?? 0);
  const sorted = (list: string[]) => [...list].sort((a, b) => version(b) - version(a) || a.length - b.length);
  const stable = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash(?:-\d{3})?$/.test(id));
  const preview = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash-preview(?:-[\w-]+)?$/.test(id));
  const lite = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash-lite(?:-\d{3})?$/.test(id));
  return [
    ...sorted(stable),
    ...(ids.includes('gemini-flash-latest') ? ['gemini-flash-latest'] : []),
    ...sorted(preview),
    ...sorted(lite),
    ...(ids.includes('gemini-flash-lite-latest') ? ['gemini-flash-lite-latest'] : []),
  ];
}

export const pickFlashModel = (models: GeminiModel[]): string | null => rankFlashModels(models)[0] ?? null;

async function discoverGeminiModels(key: string, http: Fetch): Promise<string[]> {
  if (discoveredModels) return discoveredModels;
  let response: Response;
  try {
    response = await http(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(timeouts.listMs) });
  } catch (error) {
    if (timedOut(error)) throw new AiError(504, 'Google tardó demasiado en responder. Intenta de nuevo en un momento.');
    throw error;
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error('Gemini models', response.status, detail);
    if (/API key/i.test(detail) || response.status === 401 || response.status === 403) throw new AiError(500, 'La clave de Gemini no es válida. Revisa el secreto GEMINI_API_KEY.');
    throw new AiError(502, 'No se pudo consultar la lista de modelos de Gemini. Intenta de nuevo en unos minutos.');
  }
  const data = await response.json();
  const models = rankFlashModels(data.models ?? []);
  if (!models.length) throw new AiError(500, 'Tu clave de Gemini no tiene ningún modelo Flash disponible. Configura el secreto GEMINI_MODEL.');
  console.log('Modelos de Gemini disponibles (en orden):', models.slice(0, MAX_MODELS).join(', '));
  discoveredModels = models;
  return models;
}

class ModelNotFound extends Error {}

// Prueba el modelo configurado (o el mejor disponible); si no existe, está saturado o tarda demasiado,
// pasa al siguiente modelo Flash de la clave, sin exceder el tiempo total.
async function askGemini(system: string, prompt: string, key: string, configured: string | undefined, http: Fetch): Promise<Plan> {
  const deadline = Date.now() + timeouts.totalMs;
  let candidates = configured ? [configured] : (await discoverGeminiModels(key, http)).slice(0, MAX_MODELS);
  const tried: string[] = [];
  let lastError: unknown = null;

  for (let i = 0; i < candidates.length && tried.length < MAX_MODELS; i += 1) {
    const model = candidates[i];
    if (tried.includes(model)) continue;
    const remaining = deadline - Date.now();
    if (remaining < 8_000) break;
    tried.push(model);
    try {
      return await askGeminiModel(system, prompt, key, model, http, Math.min(timeouts.generateMs, remaining));
    } catch (error) {
      const notFound = error instanceof ModelNotFound;
      const busy = error instanceof AiError && (error.status === 503 || error.status === 504);
      if (!notFound && !busy) throw error;
      lastError = error;
      console.warn(`Gemini ${model}: ${notFound ? 'no disponible' : (error as Error).message} → se prueba otro modelo.`);
      if (notFound) discoveredModels = null; // la lista guardada puede estar vieja
      if (i === candidates.length - 1) {
        const more = await discoverGeminiModels(key, http).catch((e) => {
          if (e instanceof AiError && e.status === 500) throw e; // clave inválida: se informa tal cual
          return [] as string[];
        });
        candidates = [...candidates, ...more.filter((m) => !candidates.includes(m))];
      }
    }
  }
  if (lastError instanceof ModelNotFound) {
    throw new AiError(500, `El modelo "${tried[0]}" no está disponible y no se encontró otro. Configura el secreto GEMINI_MODEL.`);
  }
  throw lastError ?? new AiError(504, TOO_SLOW);
}

// Espera entre reintentos cuando Gemini está saturado (503) o falla temporalmente (500/504).
export const retry = { delaysMs: [1500] };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mensaje legible del error de Google (no contiene datos sensibles) para mostrarlo y diagnosticar.
function googleMessage(detail: string) {
  try { return String(JSON.parse(detail)?.error?.message ?? detail).slice(0, 240); } catch { return detail.slice(0, 240); }
}

// Gemini 3 y posteriores razonan al nivel "high" si no se indica; para armar una rutina basta "low",
// que responde mucho más rápido. Google recomienda dejar la temperatura en su valor por defecto (1.0).
export function geminiTuning(model: string): Record<string, unknown> {
  const major = Number(model.match(/^gemini-(\d+)/)?.[1] ?? 0);
  if (major >= 3 || /^gemini-flash(-lite)?-latest$/.test(model)) return { thinkingConfig: { thinkingLevel: 'low' } };
  return { temperature: 0.7 };
}

async function askGeminiModel(system: string, prompt: string, key: string, model: string, http: Fetch, timeoutMs = timeouts.generateMs): Promise<Plan> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const send = (generationConfig: Record<string, unknown>, extra = '') => http(url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt + extra }] }],
      generationConfig,
    }),
  });

  const call = async (generationConfig: Record<string, unknown>, extra = '') => {
    const started = Date.now();
    let response = await send(generationConfig, extra).catch((error) => {
      console.error(`Gemini ${model}: sin respuesta tras ${Math.round((Date.now() - started) / 1000)} s`);
      throw timedOut(error) ? new AiError(504, TOO_SLOW) : error;
    });
    console.log(`Gemini ${model}: ${response.status} en ${((Date.now() - started) / 1000).toFixed(1)} s`);
    for (const wait of retry.delaysMs) {
      if (![500, 502, 503, 504].includes(response.status)) break;
      console.warn(`Gemini ${response.status}; reintento en ${wait} ms`);
      await sleep(wait);
      response = await send(generationConfig, extra).catch((error) => { throw timedOut(error) ? new AiError(504, TOO_SLOW) : error; });
    }
    return response;
  };

  // Intentos (cada uno solo si el anterior fue rechazado con 400, que llega al instante):
  // 1) ajuste de razonamiento + JSON con esquema; 2) sin el ajuste si el modelo no lo acepta;
  // 3) sin el campo de esquema (el esquema va en las instrucciones).
  let tuning = geminiTuning(model);
  let response = await call({ ...tuning, responseMimeType: 'application/json', responseJsonSchema: PLAN_SCHEMA });
  if (response.status === 404) throw new ModelNotFound(model);
  if (response.status === 400) {
    const detail = await response.clone().text();
    if (/thinking/i.test(detail) && 'thinkingConfig' in tuning) {
      console.warn('Gemini rechazó thinkingConfig:', detail);
      tuning = {};
      response = await call({ responseMimeType: 'application/json', responseJsonSchema: PLAN_SCHEMA });
    }
  }
  if (response.status === 400) {
    console.warn('Gemini rechazó responseJsonSchema:', await response.text());
    response = await call({ ...tuning, responseMimeType: 'application/json' },
      `\n\nResponde ÚNICAMENTE con un objeto JSON que cumpla este JSON Schema:\n${JSON.stringify(PLAN_SCHEMA)}`);
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error('Gemini', response.status, detail);
    if (response.status === 429) throw new AiError(429, 'Se alcanzó el límite gratuito de Gemini por ahora. Intenta en unos minutos.');
    if (response.status === 400 && /API key/i.test(detail)) throw new AiError(500, 'La clave de Gemini no es válida. Revisa el secreto GEMINI_API_KEY.');
    if (response.status === 404) throw new ModelNotFound(model);
    if (response.status === 403) throw new AiError(500, `Google rechazó la clave de Gemini (403): ${googleMessage(detail)}`);
    if (response.status >= 500) throw new AiError(503, 'Gemini está saturado en este momento. Intenta de nuevo en unos minutos.');
    throw new AiError(502, `Gemini respondió con un error (${response.status}): ${googleMessage(detail)}`);
  }
  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) throw new AiError(502, data.candidates?.[0]?.finishReason === 'SAFETY' ? 'La IA no pudo generar esta rutina. Revisa las limitaciones escritas.' : 'La IA no devolvió una rutina. Intenta de nuevo.');
  return parseJsonText(text);
}

async function askOpenAI(system: string, prompt: string, key: string, model: string, http: Fetch): Promise<Plan> {
  const response = await http('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(timeouts.generateMs),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'rutina', strict: true, schema: PLAN_SCHEMA } },
    }),
  }).catch((error) => { throw timedOut(error) ? new AiError(504, TOO_SLOW) : error; });
  if (!response.ok) {
    const detail = await response.text();
    console.error('OpenAI', response.status, detail);
    if (response.status === 401) throw new AiError(500, 'La clave de OpenAI no es válida. Revisa el secreto OPENAI_API_KEY.');
    if (response.status === 429) throw new AiError(429, 'OpenAI rechazó la solicitud por límite o falta de saldo. Revisa la facturación de la cuenta de OpenAI.');
    throw new AiError(502, `OpenAI respondió con un error (${response.status}): ${googleMessage(detail)}`);
  }
  const completion = await response.json();
  return parseJsonText(completion.choices[0].message.content);
}

export async function generatePlanWithAI(system: string, prompt: string, env: Env, http: Fetch = fetch): Promise<Plan> {
  const gemini = env('GEMINI_API_KEY');
  if (gemini) return askGemini(system, prompt, gemini, env('GEMINI_MODEL')?.trim() || undefined, http);
  const openai = env('OPENAI_API_KEY');
  if (openai) return askOpenAI(system, prompt, openai, env('OPENAI_MODEL') || 'gpt-4.1-mini', http);
  throw new AiError(500, 'Falta configurar GEMINI_API_KEY (o OPENAI_API_KEY) en los secretos de Supabase.');
}
