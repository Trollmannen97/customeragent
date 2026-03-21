import { NextResponse } from "next/server";
import {
  extractRegistrationNumber,
  lookupVehicleByRegistrationNumber,
  normalizeRegistrationNumber,
} from "@/lib/vehicle";

export const runtime = "nodejs";

type RequestBody = {
  registrationNumber?: string;
  text?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const registrationNumber =
      typeof body.registrationNumber === "string" && body.registrationNumber.trim()
        ? normalizeRegistrationNumber(body.registrationNumber)
        : typeof body.text === "string"
          ? extractRegistrationNumber(body.text)
          : null;

    if (!registrationNumber) {
      return NextResponse.json(
        { error: "Fant ikke noe gyldig registreringsnummer i foresporselen." },
        { status: 400 },
      );
    }

    const vehicle = await lookupVehicleByRegistrationNumber(registrationNumber);

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error("/api/vehicle-info error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Kunne ikke hente tekniske kjoretoydata.",
      },
      { status: 500 },
    );
  }
}
