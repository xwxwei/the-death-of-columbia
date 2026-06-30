import { FormEvent, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Mode = "continue" | "scene" | "rewrite" | "critique";
type Tone = "literary" | "noir" | "historical" | "intimate";
type Model = "deepseek-v4-flash" | "deepseek-v4-pro";

type ApiResult = {
  output: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const modeLabels: Record<Mode, string> = {
  continue: "Continue",
  scene: "Scene",
  rewrite: "Rewrite",
  critique: "Critique"
};

const toneLabels: Record<Tone, string> = {
  literary: "Literary",
  noir: "Noir",
  historical: "Historical",
  intimate: "Intimate"
};

const starterPrompt =
  "A scholar enters the abandoned archives beneath Columbia at midnight and finds a sealed letter dated tomorrow.";

function App() {
  const [prompt, setPrompt] = useState(starterPrompt);
  const [mode, setMode] = useState<Mode>("continue");
  const [tone, setTone] = useState<Tone>("literary");
  const [model, setModel] = useState<Model>("deepseek-v4-flash");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const tokenSummary = useMemo(() => {
    if (!result?.usage?.total_tokens) {
      return "No usage data yet";
    }

    return `${result.usage.total_tokens.toLocaleString()} tokens`;
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/deepseek", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt, mode, tone, model })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "The request failed.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="workbench" aria-labelledby="app-title">
        <div className="masthead">
          <p className="eyebrow">DeepSeek narrative workbench</p>
          <h1 id="app-title">The Death of Columbia</h1>
          <p className="subtitle">
            Draft, bend, test, and interrogate story fragments without putting
            API keys in the browser.
          </p>
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <label className="prompt-field" htmlFor="prompt">
            <span>Source fragment</span>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              minLength={4}
              maxLength={5000}
              required
            />
          </label>

          <div className="controls" aria-label="Generation controls">
            <label>
              <span>Mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
                {Object.entries(modeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tone</span>
              <select value={tone} onChange={(event) => setTone(event.target.value as Tone)}>
                {Object.entries(toneLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Model</span>
              <select value={model} onChange={(event) => setModel(event.target.value as Model)}>
                <option value="deepseek-v4-flash">V4 Flash</option>
                <option value="deepseek-v4-pro">V4 Pro</option>
              </select>
            </label>

            <button disabled={loading || prompt.trim().length < 4} type="submit">
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </section>

      <section className="output" aria-live="polite" aria-label="Model output">
        <div className="output-header">
          <div>
            <p className="eyebrow">Result</p>
            <h2>Draft signal</h2>
          </div>
          <span>{tokenSummary}</span>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {result ? (
          <article className="response">
            {result.output.split("\n").map((line, index) => (
              <p key={`${line}-${index}`}>{line || "\u00a0"}</p>
            ))}
          </article>
        ) : (
          <div className="empty-state">
            <p>Generate a passage to see the model response here.</p>
          </div>
        )}
      </section>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found.");
}

createRoot(root).render(<App />);
