import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

type RequestBody = {
  threadId?: string;
};

function extractCustomerReply(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(
    /Forslag til svar til kunde:\s*([\s\S]*?)(?:\n[A-ZÆØÅ][^\n]*:\s*|$)/i,
  );

  return match?.[1]?.trim() || "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const threadId = body.threadId?.trim();

    if (!threadId) {
      return NextResponse.json({ error: "threadId mangler." }, { status: 400 });
    }

    const items = await openai.beta.chatkit.threads.listItems(threadId, {
      order: "desc",
      limit: 20,
    });

    const latestAssistantMessage = items.data.find(
      (item) => item.type === "chatkit.assistant_message",
    );

    if (!latestAssistantMessage || latestAssistantMessage.type !== "chatkit.assistant_message") {
      return NextResponse.json({ reply: "", full_text: "" });
    }

    const fullText = latestAssistantMessage.content
      .map((part) => part.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      reply: extractCustomerReply(fullText),
      full_text: fullText,
    });
  } catch (error) {
    console.error("/api/chatkit/latest-reply error:", error);

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
        error: openAIMessage || "Kunne ikke hente siste svar fra ChatKit-traden.",
      },
      { status: 500 },
    );
  }
}
