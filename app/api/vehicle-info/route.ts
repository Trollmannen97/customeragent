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
    const registrationNumberInput =
      typeof body.registrationNumber === "string" ? body.registrationNumber : "";
    const textInput = typeof body.text === "string" ? body.text : "";
    const registrationNumber =
      registrationNumberInput.trim()
        ? extractRegistrationNumber(registrationNumberInput) ||
          normalizeRegistrationNumber(registrationNumberInput)
        : textInput
          ? extractRegistrationNumber(textInput)
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
