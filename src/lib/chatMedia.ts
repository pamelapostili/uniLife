import { supabase } from "./supabase";

export const CHAT_MEDIA_BUCKET = "chat-media";
/** Límite del plan gratuito de Supabase Storage por archivo. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export type AttachmentType = "image" | "video" | "file";

export type PickedAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
  type: AttachmentType;
};

export function attachmentTypeFromMime(mime: string): AttachmentType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

/** Texto que se muestra como vista previa en la lista de chats. */
export function attachmentPreview(type: AttachmentType | null | undefined, name?: string | null) {
  if (type === "image") return "📷 Foto";
  if (type === "video") return "🎥 Video";
  if (type === "file") return `📎 ${name ?? "Archivo"}`;
  return "";
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Sube el archivo a chat-media/{chatId}/... y regresa la ruta guardada. */
export async function uploadChatAttachment(chatId: string, file: PickedAttachment) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const path = `${chatId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const response = await fetch(file.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.mimeType, upsert: false });

  if (error) throw error;
  return { path, size: file.size ?? arrayBuffer.byteLength };
}

/** URLs firmadas (el bucket es privado) para varias rutas a la vez. */
export async function getSignedUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;

  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrls(paths, 60 * 60 * 24);

  if (error || !data) {
    console.warn("[chat-media.sign] ", error?.message);
    return {} as Record<string, string>;
  }

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

/** URL firmada que fuerza la descarga con el nombre original del archivo. */
export async function getDownloadUrl(path: string, name: string) {
  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60, { download: name });
  if (error) throw error;
  return data.signedUrl;
}

/** Borra todos los archivos de un chat (al eliminar el chat completo). */
export async function deleteChatFolder(chatId: string) {
  const { data } = await supabase.storage.from(CHAT_MEDIA_BUCKET).list(chatId, { limit: 1000 });
  if (data?.length) {
    await supabase.storage.from(CHAT_MEDIA_BUCKET).remove(data.map((f) => `${chatId}/${f.name}`));
  }
}
