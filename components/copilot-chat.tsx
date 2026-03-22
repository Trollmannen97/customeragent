"use client";

import { useSyncExternalStore, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

const STORAGE_KEY = "ev-copilot-chatkit-user";

function getStoredUserId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingUserId = window.localStorage.getItem(STORAGE_KEY);
  if (existingUserId) {
    return existingUserId;
  }

  const nextUserId = `web-${crypto.randomUUID()}`;
  window.localStorage.setItem(STORAGE_KEY, nextUserId);
  return nextUserId;
}

function subscribe() {
  return () => {};
}

export function CopilotChat() {
  const userId = useSyncExternalStore(subscribe, getStoredUserId, () => "");
  const [error, setError] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [latestReply, setLatestReply] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );

  async function refreshLatestReply(nextThreadId: string | null) {
    if (!nextThreadId) {
      setLatestReply("");
      setCopyState("idle");
      return;
    }

    const res = await fetch("/api/chatkit/latest-reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        threadId: nextThreadId,
      }),
    });

    const data = (await res.json()) as {
      reply?: string;
      full_text?: string;
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || "Kunne ikke hente siste svar.");
    }

    setLatestReply((data.reply || "").trim());
    setCopyState("idle");
  }

  async function handleCopyLatestReply() {
    if (!latestReply) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestReply);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  }

  const { control } = useChatKit({
    api: {
      async getClientSecret() {
        const res = await fetch("/api/chatkit/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user: getStoredUserId(),
          }),
        });

        const data = (await res.json()) as {
          client_secret?: string;
          error?: string;
        };

        if (!res.ok || !data.client_secret) {
          throw new Error(data.error || "Kunne ikke starte chatsession.");
        }

        return data.client_secret;
      },
    },
    async onClientTool(toolCall) {
      if (
        toolCall.name !== "lookup_vehicle_by_registration" &&
        toolCall.name !== "lookup_vehicle_by_regnr"
      ) {
        throw new Error(`Ukjent client tool: ${toolCall.name}`);
      }

      const candidate =
        typeof toolCall.params.registration_number === "string"
          ? toolCall.params.registration_number
          : typeof toolCall.params.registrationNumber === "string"
            ? toolCall.params.registrationNumber
            : typeof toolCall.params.regnr === "string"
              ? toolCall.params.regnr
              : typeof toolCall.params.text === "string"
                ? toolCall.params.text
                : "";

      const res = await fetch("/api/vehicle-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationNumber: candidate,
          text: candidate,
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Kunne ikke hente kjoretoydata fra Vegvesen.",
        );
      }

      return data;
    },
    locale: "nb",
    theme: "light",
    frameTitle: "EV Customer Support Copilot",
    header: {
      title: {
        enabled: true,
        text: "EV Customer Support Copilot",
      },
    },
    composer: {
      placeholder:
        "Lim inn kundehenvendelsen her, eller still et internt spørsmål.",
    },
    history: {
      enabled: true,
    },
    startScreen: {
      greeting: "Klar for ny henvendelse.",
      prompts: [
        {
          label: "Ladeproblem",
          prompt:
            "Kunden sier at bilen ikke lader hjemme. Hjelp meg med neste steg.",
        },
        {
          label: "App-problem",
          prompt:
            "Kunden kommer ikke inn i appen og er frustrert. Hvordan bor vi svare?",
        },
        {
          label: "Verksted",
          prompt: "Kunden melder om varsellampe og vibrasjon under kjoring.",
        },
      ],
    },
    onError(event) {
      setError(event.error.message || "Noe gikk galt i ChatKit.");
    },
    onReady() {
      setError("");
    },
    onThreadChange(event) {
      setThreadId(event.threadId);
      void refreshLatestReply(event.threadId);
    },
    onResponseEnd() {
      if (!threadId) {
        return;
      }

      void refreshLatestReply(threadId);
    },
  });

  if (!userId) {
    return (
      <section className="surface surface-chatkit">
        <div className="empty-state">
          <p className="empty-title">Starter copilot</p>
          <p className="empty-copy">
            Oppretter sikker sesjon mot workflowen din.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="surface surface-chatkit">
      <div className="surface-heading">
        <div>
          <p className="eyebrow">Workflow Live</p>
          <h2 className="section-title">Kundecopilot</h2>
        </div>
        <p className="section-copy">
          Skriv inn en kundehenvendelse og bruk copilot til a formulere et
          svarutkast raskt.
        </p>
      </div>

      {error ? <p className="error small">{error}</p> : null}
      <div className="chatkit-toolbar">
        <p className="toolbar-copy">
          {latestReply
            ? "Siste forslag til svar er klart for kopiering."
            : "Kopierknappen blir aktiv når copilot har laget et forslag til svar."}
        </p>
        <button
          className="copy-button"
          type="button"
          onClick={handleCopyLatestReply}
          disabled={!latestReply}
        >
          {copyState === "success"
            ? "Kopiert"
            : copyState === "error"
              ? "Feilet"
              : "Kopier forslag"}
        </button>
      </div>
      <ChatKit control={control} className="chatkit-widget" />
    </section>
  );
}
