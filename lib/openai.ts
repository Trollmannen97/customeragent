import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY mangler. Legg den inn i .env.local.");
}

if (!process.env.OPENAI_WORKFLOW_ID) {
  throw new Error("OPENAI_WORKFLOW_ID mangler. Legg den inn i .env.local.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const OPENAI_WORKFLOW_ID = process.env.OPENAI_WORKFLOW_ID;
