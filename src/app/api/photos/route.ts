import { sql, getSetting } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { chargeOrThrow, recordUsage } from "@/lib/usage";
import { createRepair, getOwnedRepair } from "@/lib/repairs";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;

/** Type réel du fichier d'après ses premiers octets (on ne fait pas confiance à l'extension). */
function sniff(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Aucune photo reçue.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "Photo trop lourde (1 Mo maximum).");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniff(bytes);
    if (!mime) throw new HttpError(415, "Format non pris en charge (JPEG, PNG ou WebP).");

    const repairIdRaw = form.get("repairId");
    const repairId = typeof repairIdRaw === "string" && repairIdRaw ? repairIdRaw : null;
    const width = Number(form.get("width")) || null;
    const height = Number(form.get("height")) || null;

    const charge = await chargeOrThrow({ userId: user.id, kind: "photo", repairId, createsRepair: !repairId });
    const repair = repairId ? await getOwnedRepair(repairId, user.id) : await createRepair(user.id, "Dépannage avec photo");
    const days = await getSetting<number>("attachment_retention_days", 90);

    const [row] = await sql<{ id: string }[]>`
      insert into attachments (repair_id, kind, mime_type, bytes, width, height, expires_at)
      values (${repair.id}, 'photo', ${mime}, ${bytes}, ${width}, ${height},
              now() + ${`${Number(days)} days`}::interval)
      returning id`;
    // Le coût IA de la photo est compté avec le message qui l'accompagne ; ici on ne trace que l'action.
    await recordUsage({ userId: user.id, repairId: repair.id, kind: "photo", provider: "sos-maison", costUsd: 0, credits: charge.credits });

    return Response.json({ id: row.id, repairId: repair.id, balance: charge.balance, warning: charge.warning });
  } catch (e) {
    return errorResponse(e);
  }
}
