// Minimal client for an OpenAI-compatible chat completions endpoint
// (Ollama / LM Studio / llama.cpp / vLLM serving a multimodal Gemma model).
import crypto from 'node:crypto';
import { log, logLlmCall } from './log.js';

// LLM_* names win; FPT_* names (project root .env) are accepted as well
const env = (...names) => names.map((n) => process.env[n]).find((v) => v !== undefined && v !== '');
const cfg = () => ({
  baseUrl: (env('LLM_BASE_URL', 'FPT_BASE_URL') || 'http://127.0.0.1:11434/v1').replace(/\/+$/, ''),
  model: env('LLM_MODEL', 'FPT_MODEL') || 'gemma4',
  apiKey: env('LLM_API_KEY', 'FPT_API_KEY') || '',
  temperature: env('LLM_TEMPERATURE') !== undefined ? Number(env('LLM_TEMPERATURE')) : null,
  timeoutMs: parseInt(env('LLM_TIMEOUT_MS') || '300000', 10),
});

export class LLMError extends Error {}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (cfg().apiKey) h.Authorization = `Bearer ${cfg().apiKey}`;
  return h;
}

export async function llmStatus() {
  const { baseUrl, model } = cfg();
  try {
    const r = await fetch(`${baseUrl}/models`, { headers: headers(), signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false, baseUrl, model, error: `HTTP ${r.status}` };
    const data = await r.json();
    const models = (data.data || []).map((m) => m.id);
    return { ok: true, baseUrl, model, models, modelAvailable: !models.length || models.some((m) => m === model || m.startsWith(`${model}:`)) };
  } catch (e) {
    return { ok: false, baseUrl, model, error: e.message };
  }
}

/**
 * @param {object} o
 * @param {string} o.system
 * @param {string} o.prompt
 * @param {string[]} [o.images] data URLs
 * @param {string} [o.purpose] what the call is for, shown in the logs (generate, image.pick, reading.crop ...)
 */
export async function chat(o) {
  return (await call(o)).text;
}

async function call({ system, prompt, images = [], temperature = 0.4, maxTokens = 8192, purpose = null, attempt = 1 }) {
  const { baseUrl, model, timeoutMs, temperature: envTemp } = cfg();
  if (envTemp !== null && !Number.isNaN(envTemp)) temperature = envTemp;
  const content = images.length
    ? [{ type: 'text', text: prompt }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
    : prompt;
  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content }],
  };
  // the server log gets sizes and timings; the full call goes to the llm log, joined by this id
  const id = crypto.randomBytes(5).toString('hex');
  const t0 = Date.now();
  const stats = () => ({ llm: id, purpose, attempt, model, ms: Date.now() - t0, images: images.length, promptChars: prompt.length });
  const record = (extra) => logLlmCall({ llm: id, purpose, attempt, model, temperature, maxTokens, ms: Date.now() - t0, system, prompt, images, ...extra });
  const failed = (extra, detail = extra.err) => { log.warn('llm.chat.failed', { ...stats(), ...extra }); record({ error: detail, status: extra.status }); };
  let r;
  try {
    r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    failed({ err: e.message });
    throw new LLMError(`Cannot reach the AI model at ${baseUrl} (${e.message}). Check LLM_BASE_URL in server/.env.`);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    failed({ status: r.status, err: t.slice(0, 300) }, t);
    throw new LLMError(`AI model error HTTP ${r.status}: ${t.slice(0, 300)}`);
  }
  let data;
  try { data = await r.json(); } catch (e) { failed({ status: r.status, err: e.message }); throw e; }
  const choice = data.choices?.[0] || {};
  const msg = choice.message || {};
  const raw = typeof msg.content === 'string' ? msg.content : Array.isArray(msg.content) ? msg.content.map((c) => c.text || '').join('') : '';
  // drop any visible thinking blocks
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\|channel\>thought[\s\S]*?<channel\|>/g, '').trim();
  log.info('llm.chat', {
    ...stats(), replyChars: text.length, tokensIn: data.usage?.prompt_tokens, tokensOut: data.usage?.completion_tokens, finish: choice.finish_reason,
  });
  record({ reply: raw, ...(msg.reasoning_content && { reasoning: msg.reasoning_content }), usage: data.usage, finish: choice.finish_reason });
  return { id, text };
}

export function extractJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[[{]/);
  if (start < 0) throw new LLMError('The AI response did not contain JSON');
  const open = t[start];
  const close = open === '{' ? '}' : ']';
  // walk to the matching bracket, respecting strings
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  const slice = end > 0 ? t.slice(start, end + 1) : t.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    // common repairs: trailing commas
    try { return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')); } catch {
      throw new LLMError('The AI response was not valid JSON');
    }
  }
}

export async function chatJson(opts, retries = 1) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const { id, text } = await call({ ...opts, attempt: i + 1 });
    try { return extractJson(text); } catch (e) {
      lastErr = e;
      log.warn('llm.json.failed', { llm: id, purpose: opts.purpose, attempt: i + 1, err: e.message });
    }
  }
  throw lastErr;
}
