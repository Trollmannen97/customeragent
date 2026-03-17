import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const docsDir = process.env.DOCS_DIR || path.join(process.cwd(), "knowledge-base");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY mangler.");
  }

  if (!fs.existsSync(docsDir)) {
    throw new Error(`Fant ikke dokumentmappe: ${docsDir}`);
  }

  const client = new OpenAI({ apiKey });

  const vectorStore = await client.vectorStores.create({
    name: "ev_support_knowledge_base",
  });

  const files = fs.readdirSync(docsDir);

  for (const fileName of files) {
    const fullPath = path.join(docsDir, fileName);
    const stat = fs.statSync(fullPath);

    if (!stat.isFile()) continue;

    const uploaded = await client.files.create({
      file: fs.createReadStream(fullPath),
      purpose: "assistants",
    });

    await client.vectorStores.files.create(vectorStore.id, {
      file_id: uploaded.id,
    });

    console.log(`Lastet opp: ${fileName} → ${uploaded.id}`);
  }

  console.log(`Vector store klar: ${vectorStore.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
