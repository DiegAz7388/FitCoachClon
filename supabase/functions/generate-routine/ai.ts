// Proveedores de IA para generar la rutina. Se elige por los secretos configurados:
//   GEMINI_API_KEY  → Google Gemini (prioridad; tiene nivel gratuito)
//   OPENAI_API_KEY  → OpenAI
// Modelos opcionales: GEMINI_MODEL, OPENAI_MODEL (por defecto gpt-4.1-mini).
// Sin GEMINI_MODEL (o si el configurado ya no existe), se consulta a Google qué modelos tiene la clave
// y se usa el Flash estable más reciente: así no se rompe cuando Google retira una versión.
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
let discoveredModel: string | null = null; // caché mientras la función siga activa

type GeminiModel = { name: string; supportedGenerationMethods?: string[] };

// Ordena candidatos: Flash estable numerado (versión más alta) > alias gemini-flash-latest > Flash preview > Flash-Lite.
export function pickFlashModel(models: GeminiModel[]): string | null {
  const ids = models
    .filter((m) => (m.supportedGenerationMethods ?? ['generateContent']).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  const version = (id: string) => Number(id.match(/^gemini-(\d+(?:\.\d+)?)-/)?.[1] ?? 0);
  const best = (list: string[]) => list.sort((a, b) => version(b) - version(a) || a.length - b.length)[0] ?? null;
  const stable = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash(?:-\d{3})?$/.test(id));
  if (stable.length) return best(stable);
  if (ids.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  const preview = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash-preview(?:-[\w-]+)?$/.test(id));
  if (preview.length) return best(preview);
  const lite = ids.filter((id) => /^gemini-\d+(?:\.\d+)?-flash-lite(?:-\d{3})?$/.test(id));
  if (lite.length) return best(lite);
  return ids.includes('gemini-flash-lite-latest') ? 'gemini-flash-lite-latest' : null;
}

async function discoverGeminiModel(key: string, http: Fetch): Promise<string> {
  if (discoveredModel) return discoveredModel;
  const response = await http(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Gemini models', response.status, detail);
    if (/API key/i.test(detail) || response.status === 401 || response.status === 403) throw new AiError(500, 'La clave de Gemini no es válida. Revisa el secreto GEMINI_API_KEY.');
    throw new AiError(502, 'No se pudo consultar la lista de modelos de Gemini. Intenta de nuevo en unos minutos.');
  }
  const data = await response.json();
  const model = pickFlashModel(data.models ?? []);
  if (!model) throw new AiError(500, 'Tu clave de Gemini no tiene ningún modelo Flash disponible. Configura el secreto GEMINI_MODEL.');
  console.log('Modelo de Gemini elegido automáticamente:', model);
  discoveredModel = model;
  return model;
}

class ModelNotFound extends Error {}

async function askGemini(system: string, prompt: string, key: string, configured: string | undefined, http: Fetch): Promise<Plan> {
  const model = configured || await discoverGeminiModel(key, http);
  try {
    return await askGeminiModel(system, prompt, key, model, http);
  } catch (error) {
    if (!(error instanceof ModelNotFound)) throw error;
    // El modelo ya no existe: se vuelve a consultar la lista (la caché puede estar vieja) una sola vez.
    discoveredModel = null;
    const next = await discoverGeminiModel(key, http);
    const unavailable = new AiError(500, `El modelo "${model}" no está disponible y no se encontró otro. Configura el secreto GEMINI_MODEL.`);
    if (next === model) throw unavailable;
    console.warn(`Modelo "${model}" no disponible; se usa "${next}".`);
    try {
      return await askGeminiModel(system, prompt, key, next, http);
    } catch (retryError) {
      if (retryError instanceof ModelNotFound) { discoveredModel = null; throw unavailable; }
      throw retryError;
    }
  }
}

async function askGeminiModel(system: string, prompt: string, key: string, model: string, http: Fetch): Promise<Plan> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const call = (generationConfig: Record<string, unknown>, extra = '') => http(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt + extra }] }],
      generationConfig: { temperature: 0.7, ...generationConfig },
    }),
  });

  // 1) JSON con esquema estricto. 2) Si la API no acepta el campo del esquema, JSON con el esquema en las instrucciones.
  let response = await call({ responseMimeType: 'application/json', responseJsonSchema: PLAN_SCHEMA });
  if (response.status === 404) throw new ModelNotFound(model);
  if (response.status === 400) {
    console.warn('Gemini rechazó responseJsonSchema:', await response.text());
    response = await call({ responseMimeType: 'application/json' },
      `\n\nResponde ÚNICAMENTE con un objeto JSON que cumpla este JSON Schema:\n${JSON.stringify(PLAN_SCHEMA)}`);
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error('Gemini', response.status, detail);
    if (response.status === 429) throw new AiError(429, 'Se alcanzó el límite gratuito de Gemini por ahora. Intenta en unos minutos.');
    if (response.status === 400 && /API key/i.test(detail)) throw new AiError(500, 'La clave de Gemini no es válida. Revisa el secreto GEMINI_API_KEY.');
    if (response.status === 404) throw new ModelNotFound(model);
    throw new AiError(502, 'El servicio de IA no respondió. Intenta de nuevo en unos minutos.');
  }
  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  if (!text) throw new AiError(502, data.candidates?.[0]?.finishReason === 'SAFETY' ? 'La IA no pudo generar esta rutina. Revisa las limitaciones escritas.' : 'La IA no devolvió una rutina. Intenta de nuevo.');
  return parseJsonText(text);
}

async function askOpenAI(system: string, prompt: string, key: string, model: string, http: Fetch): Promise<Plan> {
  const response = await http('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'rutina', strict: true, schema: PLAN_SCHEMA } },
    }),
  });
  if (!response.ok) {
    console.error('OpenAI', response.status, await response.text());
    throw new AiError(502, 'El servicio de IA no respondió. Intenta de nuevo en unos minutos.');
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
