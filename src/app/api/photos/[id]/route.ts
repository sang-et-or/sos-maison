import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Photo introuvable");
    const [p] = await sql<{ mime_type: string; bytes: Uint8Array }[]>`
      select a.mime_type, a.bytes from attachments a join repairs r on r.id = a.repair_id
      where a.id = ${id} and r.user_id = ${user.id}`;
    if (!p) throw new HttpError(404, "Photo introuvable");
    return new Response(Buffer.from(p.bytes), {
      headers: { "Content-Type": p.mime_type, "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
