import { supabase } from "./supabase";

export type RequestInfo = {
  mine?: { status: string; chat_id: string | null };
  theirs?: { status: string; chat_id: string | null };
};

export async function fetchRequestInfo(meId: string, otherId: string): Promise<RequestInfo> {
  const { data, error } = await supabase
    .from("message_requests")
    .select("sender_id, receiver_id, status, chat_id")
    .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`);

  if (error) {
    console.warn("[message_requests.select] ", error.message);
    return {};
  }

  const info: RequestInfo = {};
  (data ?? []).forEach((row: any) => {
    const other = row.sender_id === meId ? row.receiver_id : row.sender_id;
    if (other !== otherId) return;
    if (row.sender_id === meId) {
      info.mine = { status: row.status, chat_id: row.chat_id };
    } else {
      info.theirs = { status: row.status, chat_id: row.chat_id };
    }
  });

  return info;
}

export async function fetchRequestInfoBulk(meId: string, otherIds: string[]): Promise<Record<string, RequestInfo>> {
  if (otherIds.length === 0) return {};

  const { data, error } = await supabase
    .from("message_requests")
    .select("sender_id, receiver_id, status, chat_id")
    .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`);

  if (error) {
    console.warn("[message_requests.select] ", error.message);
    return {};
  }

  const map: Record<string, RequestInfo> = {};
  (data ?? []).forEach((row: any) => {
    const otherId = row.sender_id === meId ? row.receiver_id : row.sender_id;
    if (!otherIds.includes(otherId)) return;
    map[otherId] = map[otherId] ?? {};
    if (row.sender_id === meId) {
      map[otherId].mine = { status: row.status, chat_id: row.chat_id };
    } else {
      map[otherId].theirs = { status: row.status, chat_id: row.chat_id };
    }
  });

  return map;
}

export async function sendMessageRequest(meId: string, otherId: string) {
  return supabase.from("message_requests").upsert(
    {
      sender_id: meId,
      receiver_id: otherId,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sender_id,receiver_id" }
  );
}
