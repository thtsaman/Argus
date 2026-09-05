import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ integrityId: string }> }
) {
  try {
    const { integrityId } = await params;

    const record = await db.integrityRecord.findUnique({
      where: { integrityId },
      include: {
        investigation: {
          select: { id: true, title: true, caseNumber: true, status: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Integrity record not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Failed to fetch integrity record" }, { status: 500 });
  }
}
