const DEFAULT_VEGVESEN_API_URL =
  "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";

const REGISTRATION_NUMBER_PATTERN = /\b([A-Z]{1,2}\d{3,5}|EL\d{5}|EK\d{5})\b/i;

export type VehicleLookupResult = {
  registrationNumber: string;
  summary: string;
  technicalData: {
    make?: string;
    model?: string;
    year?: string;
    fuel?: string;
    bodyType?: string;
    color?: string;
    seats?: number;
    totalWeightKg?: number;
    batteryCapacityKwh?: number;
    rangeKm?: number;
    nextInspectionDue?: string;
  };
  raw: unknown;
};

export function extractRegistrationNumber(text: string) {
  const compactText = normalizeRegistrationNumber(text);
  const match = compactText.match(REGISTRATION_NUMBER_PATTERN);
  return match?.[1] || null;
}

export function normalizeRegistrationNumber(value: string) {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function readNestedString(value: unknown, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = value;

    for (const key of path) {
      if (typeof current !== "object" || current === null || !(key in current)) {
        current = undefined;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current === "string" && current.trim()) {
      return current.trim();
    }
  }

  return undefined;
}

function readNestedNumber(value: unknown, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = value;

    for (const key of path) {
      if (typeof current !== "object" || current === null || !(key in current)) {
        current = undefined;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current === "number" && Number.isFinite(current)) {
      return current;
    }
  }

  return undefined;
}

function buildVehicleSummary(
  registrationNumber: string,
  technicalData: VehicleLookupResult["technicalData"],
) {
  const identity = [
    technicalData.make,
    technicalData.model,
    technicalData.year ? `arsmodell ${technicalData.year}` : undefined,
    technicalData.fuel,
  ].filter(Boolean);

  const details = [
    technicalData.bodyType,
    technicalData.color,
    technicalData.seats ? `${technicalData.seats} seter` : undefined,
    technicalData.totalWeightKg ? `${technicalData.totalWeightKg} kg totalvekt` : undefined,
    technicalData.batteryCapacityKwh
      ? `${technicalData.batteryCapacityKwh} kWh batterikapasitet`
      : undefined,
    technicalData.rangeKm ? `${technicalData.rangeKm} km rekkevidde` : undefined,
    technicalData.nextInspectionDue
      ? `neste kontrollfrist ${technicalData.nextInspectionDue}`
      : undefined,
  ].filter(Boolean);

  if (identity.length === 0 && details.length === 0) {
    return `Tekniske kjoretoydata funnet for ${registrationNumber}.`;
  }

  return [
    `Kjoretoydata for ${registrationNumber}: ${identity.join(", ")}.`,
    details.length > 0 ? `Relevante data: ${details.join(", ")}.` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function mapVehicleResponse(
  registrationNumber: string,
  payload: unknown,
): VehicleLookupResult {
  const technicalData = {
    make: readNestedString(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "generelt", "merke", "merke"],
      ["kjoretoy", "tekniskeData", "generelt", "merke", "merke"],
      ["kjoretoy", "merke"],
    ]),
    model: readNestedString(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "generelt", "handelsbetegnelse"],
      ["kjoretoy", "tekniskeData", "generelt", "handelsbetegnelse"],
      ["kjoretoy", "modell"],
    ]),
    year: readNestedString(payload, [
      ["kjoretoy", "forstegangsregistrering", "registrertForstegangNorgeDato"],
      ["kjoretoy", "forstegangsregistrering", "registrertForstegangDato"],
    ])?.slice(0, 4),
    fuel: readNestedString(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "motorOgDrivverk", "drivstoff", "drivstoffKodeMiljodata", "beskrivelse"],
      ["kjoretoy", "tekniskeData", "motorOgDrivverk", "drivstoff", "drivstoffKodeMiljodata", "beskrivelse"],
    ]),
    bodyType: readNestedString(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "karosseriOgLasteplan", "rFKarosseri", "beskrivelse"],
      ["kjoretoy", "tekniskeData", "karosseriOgLasteplan", "rFKarosseri", "beskrivelse"],
    ]),
    color: readNestedString(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "karosseriOgLasteplan", "farge", "beskrivelse"],
      ["kjoretoy", "tekniskeData", "karosseriOgLasteplan", "farge", "beskrivelse"],
    ]),
    seats: readNestedNumber(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "persontall", "sitteplasserTotalt"],
      ["kjoretoy", "tekniskeData", "persontall", "sitteplasserTotalt"],
    ]),
    totalWeightKg: readNestedNumber(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "vekter", "tekniskTillattTotalvekt"],
      ["kjoretoy", "tekniskeData", "vekter", "tekniskTillattTotalvekt"],
    ]),
    batteryCapacityKwh: readNestedNumber(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "miljodata", "elektriskRekkevidde", "batterikapasitetKWh"],
      ["kjoretoy", "tekniskeData", "miljodata", "elektriskRekkevidde", "batterikapasitetKWh"],
    ]),
    rangeKm: readNestedNumber(payload, [
      ["kjoretoy", "godkjenning", "tekniskGodkjenning", "tekniskeData", "miljodata", "elektriskRekkevidde", "rekkeviddeKm"],
      ["kjoretoy", "tekniskeData", "miljodata", "elektriskRekkevidde", "rekkeviddeKm"],
    ]),
    nextInspectionDue: readNestedString(payload, [
      ["periodiskKjoretoyKontroll", "kontrollfrist"],
      ["kjoretoy", "periodiskKjoretoyKontroll", "kontrollfrist"],
    ]),
  };

  return {
    registrationNumber,
    summary: buildVehicleSummary(registrationNumber, technicalData),
    technicalData,
    raw: payload,
  };
}

export async function lookupVehicleByRegistrationNumber(registrationNumber: string) {
  const apiKey = process.env.VEGVESEN_API_KEY;

  if (!apiKey) {
    throw new Error("VEGVESEN_API_KEY mangler.");
  }

  const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);
  const apiUrl = process.env.VEGVESEN_API_URL || DEFAULT_VEGVESEN_API_URL;
  const queryParam = process.env.VEGVESEN_API_QUERY_PARAM || "kjennemerke";
  const apiKeyHeader = process.env.VEGVESEN_API_KEY_HEADER || "SVV-Authorization";
  const apiKeyPrefix = process.env.VEGVESEN_API_KEY_PREFIX || "Apikey";

  const url = new URL(apiUrl);
  url.searchParams.set(queryParam, normalizedRegistrationNumber);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      [apiKeyHeader]: `${apiKeyPrefix} ${apiKey}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error(`Fant ikke kjoretoydata for ${normalizedRegistrationNumber}.`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Vegvesen-oppslag feilet med status ${response.status}: ${errorText || "ukjent feil"}`,
    );
  }

  const payload = (await response.json()) as unknown;
  return mapVehicleResponse(normalizedRegistrationNumber, payload);
}
