import { splitIntoChunks } from "../../../lib/chunking";
import { embedText } from "../../../lib/embeddings";
import { createScopedClient } from "../../../lib/supabase";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  const supabase = createScopedClient(accessToken);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401 });
  }

  const { title, content } = (await req.json()) as { title?: string; content?: string };

  if (!title || typeof title !== "string" || !title.trim()) {
    return new Response(JSON.stringify({ error: "Missing or invalid title" }), { status: 400 });
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return new Response(JSON.stringify({ error: "Missing or invalid content" }), { status: 400 });
  }

  const chunks = splitIntoChunks(content);

  if (chunks.length === 0) {
    return new Response(JSON.stringify({ error: "Nie udało się podzielić tekstu na fragmenty" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        for (let i = 0; i < chunks.length; i++) {
          send({ type: "progress", current: i + 1, total: chunks.length });

          const embedding = await embedText(chunks[i]);

          const { error } = await supabase.from("documents").insert({
            title,
            content: chunks[i],
            embedding,
            metadata: { source: title, chunk_index: i, total_chunks: chunks.length },
            user_id: user.id,
          });

          if (error) {
            send({ type: "error", message: error.message });
            controller.close();
            return;
          }
        }

        send({ type: "done", chunks_saved: chunks.length });
      } catch (error) {
        send({ type: "error", message: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson" },
  });
}
