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
    powerKw?: number;
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

function readPath(value: unknown, path: Array<string | number>) {
  let current: unknown = value;

  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current) || key >= current.length) {
        return undefined;
      }

      current = current[key];
      continue;
    }

    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function readNestedString(value: unknown, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const current = readPath(value, path);

    if (typeof current === "string" && current.trim()) {
      return current.trim();
    }
  }

  return undefined;
}

function readNestedNumber(value: unknown, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const current = readPath(value, path);

    if (typeof current === "number" && Number.isFinite(current)) {
      return current;
    }

    if (typeof current === "string") {
      const parsed = Number(current);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
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
    technicalData.powerKw ? `${technicalData.powerKw} kW effekt` : undefined,
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
  const vehicleData = Array.isArray((payload as { kjoretoydataListe?: unknown })?.kjoretoydataListe)
    ? (payload as { kjoretoydataListe: unknown[] }).kjoretoydataListe[0]
    : payload;

  const technicalData = {
    make: readNestedString(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "generelt", "merke", 0, "merke"],
    ]),
    model: readNestedString(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "generelt", "handelsbetegnelse", 0],
      ["godkjenning", "tekniskGodkjenning", "kjoretoyklassifisering", "efTypegodkjenning", "variant"],
    ]),
    year: readNestedString(vehicleData, [
      ["forstegangsregistrering", "registrertForstegangNorgeDato"],
      ["godkjenning", "forstegangsGodkjenning", "forstegangRegistrertDato"],
    ])?.slice(0, 4),
    fuel: readNestedString(vehicleData, [
      [
        "godkjenning",
        "tekniskGodkjenning",
        "tekniskeData",
        "miljodata",
        "miljoOgdrivstoffGruppe",
        0,
        "drivstoffKodeMiljodata",
        "kodeBeskrivelse",
      ],
      [
        "godkjenning",
        "tekniskGodkjenning",
        "tekniskeData",
        "motorOgDrivverk",
        "motor",
        0,
        "drivstoff",
        0,
        "drivstoffKode",
        "kodeBeskrivelse",
      ],
    ]),
    bodyType: readNestedString(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "karosseriOgLasteplan", "karosseritype", "kodeNavn"],
    ]),
    color: readNestedString(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "karosseriOgLasteplan", "rFarge", 0, "kodeNavn"],
    ]),
    seats: readNestedNumber(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "persontall", "sitteplasserTotalt"],
    ]),
    powerKw: readNestedNumber(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "ovrigeTekniskeData", 0, "datafeltVerdi"],
    ]),
    totalWeightKg: readNestedNumber(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "vekter", "tillattTotalvekt"],
    ]),
    batteryCapacityKwh: readNestedNumber(vehicleData, [
      ["godkjenning", "tekniskGodkjenning", "tekniskeData", "miljodata", "elektriskRekkevidde", "batterikapasitetKWh"],
    ]),
    rangeKm: readNestedNumber(vehicleData, [
      [
        "godkjenning",
        "tekniskGodkjenning",
        "tekniskeData",
        "miljodata",
        "miljoOgdrivstoffGruppe",
        0,
        "forbrukOgUtslipp",
        0,
        "wltpKjoretoyspesifikk",
        "rekkeviddeKmBlandetkjoring",
      ],
    ]),
    nextInspectionDue: readNestedString(vehicleData, [
      ["periodiskKjoretoyKontroll", "kontrollfrist"],
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
