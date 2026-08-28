import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const users = await db.user.findMany({
    select: { id: true, name: true, role: true, email: true },
    orderBy: { role: "asc" },
  });
  return NextResponse.json({ users });
}
