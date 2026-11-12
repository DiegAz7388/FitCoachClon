// Proveedores de IA para generar la rutina. Se elige por los secretos configurados:
//   GEMINI_API_KEY  → Google Gemini (prioridad; tiene nivel gratuito)
//   OPENAI_API_KEY  → OpenAI
// Modelos opcionales: GEMINI_MODEL (por defecto gemini-2.5-flash), OPENAI_MODEL (por defecto gpt-4.1-mini).
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

async function askGemini(system: string, prompt: string, key: string, model: string, http: Fetch): Promise<Plan> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
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
    if (response.status === 404) throw new AiError(500, `El modelo "${model}" no está disponible. Cambia el secreto GEMINI_MODEL.`);
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
  if (gemini) return askGemini(system, prompt, gemini, env('GEMINI_MODEL') || 'gemini-2.5-flash', http);
  const openai = env('OPENAI_API_KEY');
  if (openai) return askOpenAI(system, prompt, openai, env('OPENAI_MODEL') || 'gpt-4.1-mini', http);
  throw new AiError(500, 'Falta configurar GEMINI_API_KEY (o OPENAI_API_KEY) en los secretos de Supabase.');
}
