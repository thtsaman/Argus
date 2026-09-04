import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InvestigationStatus } from "@prisma/client";

// Helper to generate unique case ID: ARG-2026-XXXX
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  let unique = false;
  let caseNum = "";
  let counter = 0;

  while (!unique && counter < 100) {
    const randomFourDigit = Math.floor(1000 + Math.random() * 9000);
    caseNum = `ARG-${year}-${randomFourDigit}`;
    const existing = await db.investigation.findUnique({
      where: { caseNumber: caseNum },
      select: { id: true },
    });
    if (!existing) {
      unique = true;
    }
    counter++;
  }

  if (!unique) {
    caseNum = `ARG-${year}-${Date.now().toString().slice(-4)}`;
  }
  return caseNum;
}

// GET /api/investigations - list with search and status filter
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const where: any = {};

    if (status && status !== "ALL") {
      if (Object.values(InvestigationStatus).includes(status as InvestigationStatus)) {
        where.status = status as InvestigationStatus;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { caseNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const investigations = await db.investigation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        lead: { select: { name: true } },
        _count: {
          select: {
            entities: true,
            relationships: true,
            evidence: true,
          },
        },
      },
    });

    return NextResponse.json(investigations);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch investigations" },
      { status: 500 }
    );
  }
}

// POST /api/investigations - create new investigation
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, investigator, sourceOrigin, primaryLocation, startDate, endDate, status } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Investigation Name is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return NextResponse.json(
        { error: "End Date cannot be earlier than Start Date" },
        { status: 400 }
      );
    }

    const caseNumber = await generateCaseNumber();

    // Default status ACTIVE
    let initialStatus: InvestigationStatus = InvestigationStatus.ACTIVE;
    if (status && Object.values(InvestigationStatus).includes(status)) {
      initialStatus = status as InvestigationStatus;
    }

    // Attach metadata for investigator, source/origin, location
    const metadata: Record<string, any> = {};
    if (investigator?.trim()) metadata.investigator = investigator.trim();
    if (sourceOrigin?.trim()) metadata.sourceOrigin = sourceOrigin.trim();
    if (primaryLocation?.trim()) metadata.primaryLocation = primaryLocation.trim();

    const investigation = await db.investigation.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        caseNumber,
        status: initialStatus,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      },
    });

    return NextResponse.json(investigation, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create investigation" },
      { status: 500 }
    );
  }
}
