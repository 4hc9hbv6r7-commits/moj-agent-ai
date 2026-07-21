import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const candidates = data.candidates?.[0];
      if (!candidates) {
        return NextResponse.json(
          { error: "No image generated" },
          { status: 500 }
        );
      }

      let imageBase64 = "";
      let text = "";

      for (const part of candidates.content?.parts || []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
        }
        if (part.text) {
          text = part.text;
        }
      }

      if (!imageBase64) {
        return NextResponse.json(
          { error: "Failed to generate image" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        image: `data:image/png;base64,${imageBase64}`,
        text: text || "Generated image",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
