import { NextResponse } from "next/server";
import type {
  Response,
  ResponseInputItem,
  ResponseInputMessageItem,
  ResponseOutputMessage,
} from "openai/resources/responses/responses";
import { OPENAI_MODEL, VECTOR_STORE_ID, openai } from "@/lib/openai";
import { SYSTEM_PROMPT } from "@/lib/prompt";

export const runtime = "nodejs";

type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

type RequestBody = {
  message?: string;
  history?: ConversationTurn[];
};

type SourceLink = {
  title: string;
  url: string;
  sourceType: "web";
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

const APPROVED_WEB_DOMAINS = [
  "volvocarstoroslo.no",
  "volvocars.com",
  "zeekrstoroslo.no",
  "polestarstoroslo.no",
  "polestar.com",
] as const;

const COPILOT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "case_type",
    "assessment",
    "checks",
    "customer_reply",
    "escalation_target",
    "escalation_reason",
    "follow_up_questions",
    "confidence",
    "needs_web_search",
    "source_summary",
  ],
  properties: {
    case_type: {
      type: "string",
      description: "Kort kategori for saken.",
    },
    assessment: {
      type: "string",
      description: "Kort vurdering av hva saken sannsynligvis gjelder.",
    },
    checks: {
      type: "array",
      items: { type: "string" },
      description: "Prioriterte sjekkpunkter for kundebehandleren.",
    },
    customer_reply: {
      type: "string",
      description: "Profesjonelt svarutkast til kunden.",
    },
    escalation_target: {
      type: "string",
      enum: ["kundeservice", "verksted", "teknisk support", "annet"],
    },
    escalation_reason: {
      type: "string",
      description: "Kort forklaring for valgt eskalering.",
    },
    follow_up_questions: {
      type: "array",
      items: { type: "string" },
      description: "Sporsmal som bor avklares hvis noe mangler.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    needs_web_search: {
      type: "boolean",
      description: "True hvis websok trengs for a gi et forsvarlig svar.",
    },
    source_summary: {
      type: "string",
      description: "Kort oppsummering av kunnskapsgrunnlaget.",
    },
  },
} as const;

function extractSources(response: Response) {
  const sourceMap = new Map<string, SourceLink>();

  for (const item of response.output) {
    if (
      item.type === "web_search_call" &&
      item.action.type === "search" &&
      Array.isArray(item.action.sources)
    ) {
      for (const source of item.action.sources) {
        if (source.type === "url" && !sourceMap.has(source.url)) {
          sourceMap.set(source.url, {
            title: new URL(source.url).hostname.replace(/^www\./, ""),
            url: source.url,
            sourceType: "web",
          });
        }
      }
    }
  }

  return Array.from(sourceMap.values());
}

function parseAnalysis(response: Response) {
  const outputText = response.output_text?.trim();

  if (!outputText) {
    throw new Error("Modellen returnerte ingen tekst.");
  }

  return JSON.parse(outputText) as CopilotAnalysis;
}

function buildInput(message: string, history: ConversationTurn[] = []): ResponseInputItem[] {
  const recentTurns = history.slice(-6);
  const input: ResponseInputItem[] = recentTurns.map((turn, index) => {
    if (turn.role === "user") {
      const userMessage: ResponseInputMessageItem = {
        id: `history-user-${index}`,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: turn.text }],
      };

      return userMessage;
    }

    const assistantMessage: ResponseOutputMessage = {
      id: `history-assistant-${index}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: turn.text, annotations: [] }],
    };

    return assistantMessage;
  });

  input.push({
    role: "user",
    content: [{ type: "input_text", text: message }],
  });

  return input;
}

async function createCopilotResponse(input: ResponseInputItem[], requireWebSearch = false) {
  const tools = [];

  if (!requireWebSearch && VECTOR_STORE_ID) {
    tools.push({
      type: "file_search" as const,
      vector_store_ids: [VECTOR_STORE_ID],
    });
  }

  tools.push({
    type: "web_search" as const,
    filters: {
      allowed_domains: [...APPROVED_WEB_DOMAINS],
    },
    search_context_size: "medium" as const,
  });

  return (await openai.responses.create({
    model: OPENAI_MODEL,
    instructions:
      requireWebSearch ?
        `${SYSTEM_PROMPT}

Ekstra regel for dette forsøket:
- Du skal bruke Web Search aktivt for a hente offentlig eller oppdatert informasjon for denne saken.
- Hvis websok ikke gir nok grunnlag, behold needs_web_search som true og sett confidence til low eller medium.`
      : SYSTEM_PROMPT,
    include: ["web_search_call.action.sources"],
    input,
    text: {
      format: {
        type: "json_schema",
        name: "ev_support_copilot_analysis",
        strict: true,
        schema: COPILOT_RESPONSE_SCHEMA,
      },
    },
    tools,
    ...(requireWebSearch ? { tool_choice: "required" as const } : {}),
  })) as Response;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "Meldingen kan ikke vare tom." }, { status: 400 });
    }

    const input = buildInput(message, history);

    let response = await createCopilotResponse(input);
    let analysis = parseAnalysis(response);
    let sources = extractSources(response);

    if (analysis.needs_web_search && sources.length === 0) {
      response = await createCopilotResponse(input, true);
      analysis = parseAnalysis(response);
      sources = extractSources(response);
    }

    return NextResponse.json({
      analysis,
      request_id: response.id,
      sources,
    });
  } catch (error) {
    console.error("/api/copilot error:", error);

    const openAIMessage =
      typeof error === "object" &&
      error !== null &&
      "error" in error &&
      typeof error.error === "object" &&
      error.error !== null &&
      "message" in error.error &&
      typeof error.error.message === "string"
        ? error.error.message
        : null;

    return NextResponse.json(
      {
        error: openAIMessage || "Noe gikk galt da copilot skulle analysere henvendelsen.",
      },
      { status: 500 },
    );
  }
}
