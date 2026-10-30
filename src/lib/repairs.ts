import "server-only";
import { sql } from "./db";
import { HttpError } from "./auth";
import type { RiskLevel } from "./safety/risk";

export interface Repair {
  id: string;
  user_id: string;
  title: string;
  status: "open" | "resolved" | "needs_pro" | "abandoned";
  risk_level: RiskLevel;
  pro_category: string | null;
  keep: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StoredMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  risk_level: number | null;
  card: import("./ai/card").RepairCard | null;
  card_done: number[];
  created_at: Date;
}

export async function getOwnedRepair(repairId: string, userId: string): Promise<Repair> {
  if (!/^[0-9a-f-]{36}$/i.test(repairId)) throw new HttpError(404, "Dépannage introuvable");
  const [r] = await sql<Repair[]>`select * from repairs where id = ${repairId} and user_id = ${userId}`;
  if (!r) throw new HttpError(404, "Dépannage introuvable");
  return r;
}

export async function createRepair(userId: string, firstText: string): Promise<Repair> {
  const title = firstText.replace(/\s+/g, " ").trim().slice(0, 70) || "Nouveau dépannage";
  const [r] = await sql<Repair[]>`insert into repairs (user_id, title) values (${userId}, ${title}) returning *`;
  return r;
}

export async function listMessages(repairId: string, limit = 40): Promise<StoredMessage[]> {
  const rows = await sql<StoredMessage[]>`
    select id, role, content, risk_level, card, card_done, created_at from messages
    where repair_id = ${repairId} order by id desc limit ${limit}`;
  return rows.reverse();
}

export async function listSources(repairId: string) {
  return sql<{ message_id: number; url: string; title: string; is_video: boolean }[]>`
    select message_id, url, title, is_video from sources where repair_id = ${repairId} order by id`;
}

export async function listPhotos(repairId: string) {
  return sql<{ id: string; message_id: number | null }[]>`
    select id, message_id from attachments where repair_id = ${repairId} and kind = 'photo' order by created_at`;
}
