import { NextResponse } from "next/server";
import { embedText } from "../../../lib/embeddings";

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing or invalid text" }, { status: 400 });
    }

    const embedding = await embedText(text);

    return NextResponse.json({ embedding });
  } catch (error) {
    console.error("Embed API error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
