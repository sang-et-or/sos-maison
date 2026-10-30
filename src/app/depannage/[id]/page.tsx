import { redirect, notFound } from "next/navigation";
import { currentUser, HttpError } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getOwnedRepair, listMessages, listPhotos, listSources } from "@/lib/repairs";
import { Chat, type ChatMessage } from "@/components/Chat";

export const dynamic = "force-dynamic";

export default async function RepairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/depannage/${id}`)}`);

  const [{ premium }] = await sql<{ premium: boolean }[]>`select is_premium(${user.id}) as premium`;
  const balance = premium ? null : user.credit_balance;

  if (id === "nouveau") {
    return <Chat repairId={null} title={null} initialMessages={[]} initialStatus="open" proCategory={null} riskLevel={0} balance={balance} />;
  }

  let repair;
  try {
    repair = await getOwnedRepair(id, user.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const [messages, sources, photos] = await Promise.all([listMessages(repair.id, 100), listSources(repair.id), listPhotos(repair.id)]);

  const initial: ChatMessage[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      key: `db${m.id}`,
      id: m.id,
      card: m.card,
      cardDone: m.card_done ?? [],
      role: m.role as "user" | "assistant",
      content: m.content,
      photos: photos.filter((p) => p.message_id === m.id).map((p) => `/api/photos/${p.id}`),
      sources: sources.filter((s) => s.message_id === m.id).map((s) => ({ url: s.url, title: s.title, isVideo: s.is_video })),
    }));

  return (
    <Chat
      repairId={repair.id}
      title={repair.title}
      initialMessages={initial}
      initialStatus={repair.status}
      proCategory={repair.pro_category}
      riskLevel={repair.risk_level}
      balance={balance}
    />
  );
}
