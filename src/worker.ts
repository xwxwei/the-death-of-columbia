export interface Env {
  ASSETS: Fetcher;
  DEEPSEEK_API_KEY?: string;
}

type GenerationMode = "continue" | "scene" | "rewrite" | "critique";
type Tone = "literary" | "noir" | "historical" | "intimate";
type DeepSeekModel = "deepseek-v4-flash" | "deepseek-v4-pro";

type RequestBody = {
  prompt?: unknown;
  mode?: unknown;
  tone?: unknown;
  model?: unknown;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const modes = new Set<GenerationMode>(["continue", "scene", "rewrite", "critique"]);
const tones = new Set<Tone>(["literary", "noir", "historical", "intimate"]);
const models = new Set<DeepSeekModel>(["deepseek-v4-flash", "deepseek-v4-pro"]);

const modeInstructions: Record<GenerationMode, string> = {
  continue: "Continue the fragment with momentum, image, and narrative consequence.",
  scene: "Turn the fragment into a complete scene with place, pressure, and movement.",
  rewrite: "Rewrite the fragment more sharply while preserving its core meaning.",
  critique: "Critique the fragment and give concrete revisions before a brief rewrite."
};

const toneInstructions: Record<Tone, string> = {
  literary: "Use precise literary prose and layered implication.",
  noir: "Use tense, shadowed prose with moral pressure and hard edges.",
  historical: "Ground the prose in institutional memory, dates, objects, and social texture.",
  intimate: "Keep the voice close, sensory, and psychologically exact."
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}

function normalizeChoice<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

async function parseBody(request: Request): Promise<RequestBody> {
  try {
    return (await request.json()) as RequestBody;
  } catch {
    return {};
  }
}

async function handleDeepSeek(request: Request, env: Env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  if (!env.DEEPSEEK_API_KEY) {
    return json(
      { error: "DEEPSEEK_API_KEY is not configured for this Cloudflare Worker." },
      { status: 500 }
    );
  }

  const body = await parseBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const mode = normalizeChoice(body.mode, modes, "continue");
  const tone = normalizeChoice(body.tone, tones, "literary");
  const model = normalizeChoice(body.model, models, "deepseek-v4-flash");

  if (prompt.length < 4) {
    return json({ error: "Prompt is too short." }, { status: 400 });
  }

  if (prompt.length > 5000) {
    return json({ error: "Prompt is too long." }, { status: 400 });
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an exacting narrative editor for a project called The Death of Columbia. Keep responses useful, specific, and ready to paste into a draft."
        },
        {
          role: "user",
          content: `${modeInstructions[mode]}\n${toneInstructions[tone]}\n\nFragment:\n${prompt}`
        }
      ],
      thinking: {
        type: "disabled"
      },
      temperature: mode === "critique" ? 0.45 : 0.82,
      max_tokens: mode === "critique" ? 1200 : 900
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return json(
      {
        error: "DeepSeek request failed.",
        status: response.status,
        detail: detail.slice(0, 600)
      },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as DeepSeekResponse;
  const output = payload.choices?.[0]?.message?.content?.trim();

  if (!output) {
    return json({ error: "DeepSeek returned an empty response." }, { status: 502 });
  }

  return json({
    output,
    usage: payload.usage
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "the-death-of-columbia" });
    }

    if (url.pathname === "/api/deepseek") {
      return handleDeepSeek(request, env);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
