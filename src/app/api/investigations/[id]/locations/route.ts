import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const locations = await db.location.findMany({
    where: { investigationId: id },
    include: {
      events: {
        select: { id: true, title: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });

  return NextResponse.json({ locations });
}
