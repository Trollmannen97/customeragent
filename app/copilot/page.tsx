import { CopilotChat } from "@/components/copilot-chat";

export default function CopilotPage() {
  return (
    <main className="page-shell">
      <div className="container container-narrow">
        <section className="hero hero-centered">
          <h1>Volvo Car - Stor Oslo</h1>
          <div className="hero-mark" aria-hidden="true">
            🤖
          </div>
        </section>
        <CopilotChat />
      </div>
    </main>
  );
}
