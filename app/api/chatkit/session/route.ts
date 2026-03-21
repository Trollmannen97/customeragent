import { NextResponse } from "next/server";
import { OPENAI_WORKFLOW_ID, openai } from "@/lib/openai";

export const runtime = "nodejs";

type RequestBody = {
  user?: string;
};

function fallbackUser() {
  return `web-${crypto.randomUUID()}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const user = typeof body.user === "string" && body.user.trim() ? body.user.trim() : fallbackUser();

    const session = await openai.beta.chatkit.sessions.create({
      user,
      workflow: {
        id: OPENAI_WORKFLOW_ID,
      },
      expires_after: {
        anchor: "created_at",
        seconds: 600,
      },
      chatkit_configuration: {
        automatic_thread_titling: {
          enabled: true,
        },
        history: {
          enabled: true,
          recent_threads: 20,
        },
        file_upload: {
          enabled: false,
        },
      },
    });

    return NextResponse.json({
      client_secret: session.client_secret,
      expires_at: session.expires_at,
    });
  } catch (error) {
    console.error("/api/chatkit/session error:", error);

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
        error: openAIMessage || "Kunne ikke opprette ChatKit-session.",
      },
      { status: 500 },
    );
  }
}
