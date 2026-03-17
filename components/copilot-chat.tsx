"use client";

import { useState } from "react";

type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

type CopilotAnalysis = {
  case_type: string;
  assessment: string;
  checks: string[];
  customer_reply: string;
  escalation_target: "kundeservice" | "verksted" | "teknisk support" | "annet";
  escalation_reason: string;
  follow_up_questions: string[];
  confidence: "high" | "medium" | "low";
  needs_web_search: boolean;
  source_summary: string;
};

type CopilotResponse = {
  analysis?: CopilotAnalysis;
  request_id?: string;
  error?: string;
  sources?: Array<{
    title: string;
    url: string;
    sourceType: "web";
  }>;
};

function confidenceLabel(confidence: CopilotAnalysis["confidence"]) {
  switch (confidence) {
    case "high":
      return "Hoy trygghet";
    case "medium":
      return "Middels trygghet";
    case "low":
      return "Lav trygghet";
    default:
      return confidence;
  }
}

export function CopilotChat() {
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [sources, setSources] = useState<CopilotResponse["sources"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ConversationTurn[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setLoading(true);
    setError("");
    setAnalysis(null);
    setSources([]);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage, history }),
      });

      const data = (await res.json()) as CopilotResponse;

      if (!res.ok) {
        throw new Error(data.error || "Noe gikk galt.");
      }

      if (!data.analysis) {
        throw new Error("Ingen strukturert respons fra modellen.");
      }

      const nextAnalysis = data.analysis;

      setAnalysis(nextAnalysis);
      setSources(data.sources || []);
      setHistory((current) => [
        ...current,
        { role: "user", text: trimmedMessage },
        { role: "assistant", text: nextAnalysis.customer_reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessage("");
    setAnalysis(null);
    setError("");
    setSources([]);
    setHistory([]);
  }

  return (
    <div className="copilot-layout">
      <section className="surface surface-input">
        <div className="surface-heading">
          <div>
            <p className="eyebrow">Copilot V2</p>
            <h2 className="section-title">Analyser kundehenvendelse</h2>
          </div>
          <p className="section-copy"></p>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            className="textarea"
            placeholder="Lim inn kundehenvendelsen her, eller skriv et internt spørsmål du vil ha hjelp til."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <div className="actions">
            <button
              className="button"
              type="submit"
              disabled={loading || !message.trim()}
            >
              {loading ? "Analyserer ..." : "Analyser sak"}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={handleClear}
              disabled={loading}
            >
              Ny samtale
            </button>
          </div>
        </form>

        {error ? <p className="error small">{error}</p> : null}
      </section>

      <section className="surface surface-response">
        {analysis ? (
          <>
            <div className="analysis-header">
              <div>
                <p className="eyebrow">Sakstype</p>
                <h3 className="analysis-title">{analysis.case_type}</h3>
              </div>
              <div className={`confidence confidence-${analysis.confidence}`}>
                {confidenceLabel(analysis.confidence)}
              </div>
            </div>

            <div className="analysis-flow">
              <section className="analysis-section">
                <h4 className="card-title">Kort vurdering</h4>
                <p className="card-copy">{analysis.assessment}</p>
              </section>

              <section className="analysis-section">
                <h4 className="card-title">Kunnskapsgrunnlag</h4>
                <p className="card-copy">{analysis.source_summary}</p>
              </section>

              <section className="analysis-section">
                <h4 className="card-title">Hva bør sjekkes først</h4>
                <ul className="detail-list">
                  {analysis.checks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="analysis-section">
                <h4 className="card-title">Forslag til svar til kunde</h4>
                <div className="response response-compact">
                  {analysis.customer_reply}
                </div>
              </section>

              <section className="analysis-section">
                <h4 className="card-title">Eskalering</h4>
                <p className="card-copy escalation-line">
                  <strong>{analysis.escalation_target}</strong>
                  {" - "}
                  {analysis.escalation_reason}
                </p>
              </section>

              <section className="analysis-section">
                <h4 className="card-title">Hva mangler eventuelt</h4>
                {analysis.follow_up_questions.length > 0 ? (
                  <ul className="detail-list">
                    {analysis.follow_up_questions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="card-copy">
                    Ingen tydelige avklaringssporsmal akkurat na.
                  </p>
                )}
              </section>

              {sources && sources.length > 0 ? (
                <div className="sources">
                  <p className="sources-title">Kilder brukt fra websok</p>
                  <ul className="sources-list">
                    {sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p className="empty-title">Svaret vises her</p>
            <p className="empty-copy"></p>
          </div>
        )}
      </section>
    </div>
  );
}
