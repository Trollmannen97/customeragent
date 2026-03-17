import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EV Customer Support Copilot",
  description: "Privat AI-copilot for Volvo, Polestar og Zeekr kundeservice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
