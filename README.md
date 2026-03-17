# EV Customer Support Copilot V1

En privat Next.js-app for å teste en intern AI-copilot til kundeservice for Volvo, Polestar og Zeekr.

## Hva denne V1-en gjør

- lar deg lime inn en kundehenvendelse
- sender meldingen til OpenAI Responses API
- bruker `file_search` mot kunnskapsmotoren din
- lar modellen bruke `code_interpreter` ved behov
- returnerer et strukturert svar med:
  - Sakstype
  - Kort vurdering
  - Hva bør sjekkes først
  - Forslag til svar til kunde
  - Eskalering

## 1. Installer prosjektet

```bash
npm install
```

## 2. Sett miljøvariabler

Kopier `.env.example` til `.env.local` og fyll inn verdiene.

```bash
cp .env.example .env.local
```

Du trenger minst:

- `OPENAI_API_KEY`
- `OPENAI_VECTOR_STORE_ID`
- `APP_BASIC_AUTH_USERNAME`
- `APP_BASIC_AUTH_PASSWORD`

## 3. Start lokalt

```bash
npm run dev
```

Åpne deretter:

```bash
http://localhost:3000
```

## 4. Privat tilgang

Appen bruker enkel Basic Auth i `proxy.ts`.
Hvis `APP_BASIC_AUTH_USERNAME` og `APP_BASIC_AUTH_PASSWORD` er satt, må du logge inn før siden lastes.

## 5. Lage vector store fra lokale filer (valgfritt)

Legg dokumentene dine i en mappe, for eksempel `knowledge-base/`, og kjør:

```bash
npm run vector-store:setup
```

Dette scriptet:

- oppretter en vector store
- laster opp alle filer i mappen
- legger filene til i vector store

Deretter kopierer du vector store ID inn i `.env.local` som `OPENAI_VECTOR_STORE_ID`.

## 6. Viktige filer

- `app/copilot/page.tsx` – chatgrensesnittet
- `app/api/copilot/route.ts` – serverkall til OpenAI
- `lib/prompt.ts` – systemprompten
- `proxy.ts` – privat Basic Auth
- `scripts/setup-vector-store.ts` – valgfri helper for kunnskapsbasen

## 7. Videre forbedringer

Når V1 fungerer kan du bygge videre med:

- lagring av samtaler
- flere svarmoduser (e-post / chat)
- mer granular routing per sakstype
- dedikert admin-side for kunnskapsbasen
- ekte innlogging med Supabase Auth eller Auth.js
# customeragent
