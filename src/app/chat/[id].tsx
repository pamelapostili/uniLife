import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AppAlert from "../../components/AppAlert";
import {
  attachmentPreview,
  attachmentTypeFromMime,
  CHAT_MEDIA_BUCKET,
  formatBytes,
  getDownloadUrl,
  getSignedUrls,
  MAX_ATTACHMENT_BYTES,
  uploadChatAttachment,
  type PickedAttachment,
} from "../../lib/chatMedia";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../lib/user-context";

const MESSAGE_FIELDS =
  "id, chat_id, sender_id, message, created_at, attachment_path, attachment_type, attachment_name, attachment_mime, attachment_size, edited_at";

const isWeb = Platform.OS === "web";

type Viewer = { type: "image" | "video"; url: string; path: string; name: string } | null;

export default function ChatThread() {
  const { user, loading } = useUser();
  const params = useLocalSearchParams();
  const router = useRouter();
  const chatId = params.id as string | undefined;
  const [messages, setMessages] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [text, setText] = useState("");
  const [otherId, setOtherId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("Chat");
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [viewer, setViewer] = useState<Viewer>(null);
  const [messageToDelete, setMessageToDelete] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const listRef = useRef<FlatList>(null);
  const requestedPaths = useRef(new Set<string>());

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
  }, [loading, user]);

  useEffect(() => {
    if (!chatId || !user) return;

    (async () => {
      const { data: otherRow } = await supabase
        .from("chat_participants")
        .select("user_id")
        .eq("chat_id", chatId)
        .neq("user_id", user.id)
        .maybeSingle();

      if (otherRow?.user_id) {
        setOtherId(otherRow.user_id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", otherRow.user_id)
          .maybeSingle();

        const name = profile?.full_name ?? "Usuario";
        setOtherName(name);
        setOtherAvatar(
          profile?.avatar_url || `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(name)}`
        );
      }
    })();
  }, [chatId, user]);

  useEffect(() => {
    if (!chatId || !user) {
      setFetching(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_FIELDS)
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!error && data) {
        setMessages(data as any[]);
      } else if (error) {
        console.warn("[messages.select] ", error.message);
      }

      setFetching(false);
    })();
  }, [chatId, user]);

  // El bucket es privado: pedimos URLs firmadas para los adjuntos que aún no tienen una.
  useEffect(() => {
    const pending = messages
      .map((m) => m.attachment_path as string | null)
      .filter((p): p is string => !!p && !requestedPaths.current.has(p));

    if (!pending.length) return;
    pending.forEach((p) => requestedPaths.current.add(p));

    getSignedUrls(pending).then((urls) => setMediaUrls((prev) => ({ ...prev, ...urls })));
  }, [messages]);

  // Tiempo real: mensajes nuevos aparecen y los eliminados desaparecen al instante,
  // en este dispositivo y en el del otro usuario.
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const nuevo = payload.new as any;
          setMessages((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const editado = payload.new as any;
          setMessages((prev) => prev.map((m) => (m.id === editado.id ? { ...m, ...editado } : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const borrado = payload.old as any;
          if (borrado?.id) setMessages((prev) => prev.filter((m) => m.id !== borrado.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  async function updateChatPreview(lastMessage: string) {
    if (!chatId) return;
    await supabase
      .from("chats")
      .update({ last_message: lastMessage, updated_at: new Date().toISOString() })
      .eq("id", chatId);
  }

  async function sendMessage() {
    if (editingMessage) return saveEdit();
    if (!text.trim() || !chatId || !user) return;

    const messageText = text.trim();
    const newMsg = {
      chat_id: chatId,
      sender_id: user.id,
      message: messageText,
    };

    setText("");

    const { data, error } = await supabase
      .from("messages")
      .insert(newMsg)
      .select(MESSAGE_FIELDS);

    if (!error && data?.length) {
      setMessages((m) => (m.some((x) => x.id === data[0].id) ? m : [...m, data[0]]));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
      await updateChatPreview(messageText);
    } else if (error) {
      console.warn("[messages.insert] ", error.message);
      setErrorMsg("No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.");
    }
  }

  async function sendAttachments(files: PickedAttachment[]) {
    if (!chatId || !user || !files.length) return;

    const tooBig = files.filter((f) => f.size && f.size > MAX_ATTACHMENT_BYTES);
    const valid = files.filter((f) => !(f.size && f.size > MAX_ATTACHMENT_BYTES));

    if (tooBig.length) {
      setErrorMsg(
        `${tooBig.map((f) => f.name).join(", ")} pesa más de 50 MB y no se puede enviar.`
      );
    }

    // La leyenda (si escribiste algo) acompaña al primer archivo.
    const caption = text.trim() || null;
    if (caption && valid.length) setText("");

    setUploadingCount((c) => c + valid.length);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      try {
        const { path, size } = await uploadChatAttachment(chatId, file);

        const { data, error } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            sender_id: user.id,
            message: i === 0 ? caption : null,
            attachment_path: path,
            attachment_type: file.type,
            attachment_name: file.name,
            attachment_mime: file.mimeType,
            attachment_size: size,
          })
          .select(MESSAGE_FIELDS);

        if (error || !data?.length) {
          // Si no se pudo guardar el mensaje, no dejamos el archivo huérfano.
          await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]);
          throw error ?? new Error("No se guardó el mensaje");
        }

        setMessages((m) => (m.some((x) => x.id === data[0].id) ? m : [...m, data[0]]));
        await updateChatPreview(
          i === 0 && caption ? caption : attachmentPreview(file.type, file.name)
        );
      } catch (e: any) {
        console.warn("[chat-media.upload] ", e?.message ?? e);
        setErrorMsg(`No se pudo enviar "${file.name}": ${e?.message ?? "error desconocido"}`);
      } finally {
        setUploadingCount((c) => c - 1);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
      }
    }
  }

  async function pickFromGallery() {
    setAttachMenuVisible(false);

    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setErrorMsg("Necesitamos acceso a tus fotos y videos para poder enviarlos.");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });

    if (resultado.canceled || !resultado.assets?.length) return;
    sendAttachments(resultado.assets.map(imagePickerAssetToAttachment));
  }

  async function takeWithCamera() {
    setAttachMenuVisible(false);

    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setErrorMsg("Necesitamos acceso a la cámara para tomar fotos y videos.");
      return;
    }

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });

    if (resultado.canceled || !resultado.assets?.length) return;
    sendAttachments(resultado.assets.map(imagePickerAssetToAttachment));
  }

  async function pickDocument() {
    setAttachMenuVisible(false);

    const resultado = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (resultado.canceled || !resultado.assets?.length) return;

    sendAttachments(
      resultado.assets.map((a) => {
        const mimeType = a.mimeType ?? "application/octet-stream";
        return { uri: a.uri, name: a.name, mimeType, size: a.size, type: attachmentTypeFromMime(mimeType) };
      })
    );
  }

  async function openFile(item: any) {
    try {
      const url = await getDownloadUrl(item.attachment_path, item.attachment_name ?? "archivo");
      await Linking.openURL(url);
    } catch (e: any) {
      setErrorMsg(`No se pudo abrir el archivo: ${e?.message ?? e}`);
    }
  }

  async function confirmDeleteMessage() {
    const msg = messageToDelete;
    if (!msg) return;
    setMessageToDelete(null);

    // Borrado real: primero el archivo del almacenamiento, después el mensaje.
    if (msg.attachment_path) {
      const { error: storageError } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .remove([msg.attachment_path]);
      if (storageError) console.warn("[chat-media.remove] ", storageError.message);
    }

    const { data, error } = await supabase
      .from("messages")
      .delete()
      .eq("id", msg.id)
      .select("id");

    if (error || !data?.length) {
      console.warn("[messages.delete] ", error?.message ?? "sin permiso");
      setErrorMsg("No se pudo eliminar el mensaje.");
      return;
    }

    const restantes = messages.filter((m) => m.id !== msg.id);
    setMessages(restantes);

    const ultimo = restantes[restantes.length - 1];
    await updateChatPreview(
      ultimo ? ultimo.message || attachmentPreview(ultimo.attachment_type, ultimo.attachment_name) : ""
    );
  }

  function startEdit(msg: any) {
    setEditingMessage(msg);
    setText(msg.message ?? "");
  }

  function cancelEdit() {
    setEditingMessage(null);
    setText("");
  }

  async function saveEdit() {
    const msg = editingMessage;
    if (!msg) return;

    const nuevoTexto = text.trim();
    // Un mensaje de solo texto no puede quedar vacío; uno con archivo sí (se quita la leyenda).
    if (!nuevoTexto && !msg.attachment_path) return;
    if (nuevoTexto === (msg.message ?? "")) return cancelEdit();

    const { data, error } = await supabase
      .from("messages")
      .update({ message: nuevoTexto || null, edited_at: new Date().toISOString() })
      .eq("id", msg.id)
      .select(MESSAGE_FIELDS);

    if (error || !data?.length) {
      console.warn("[messages.update] ", error?.message ?? "sin permiso");
      setErrorMsg("No se pudo editar el mensaje.");
      return;
    }

    cancelEdit();
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? data[0] : m)));

    if (messages[messages.length - 1]?.id === msg.id) {
      await updateChatPreview(nuevoTexto || attachmentPreview(msg.attachment_type, msg.attachment_name));
    }
  }

  async function copyMessage(msg: any) {
    if (msg.message) await Clipboard.setStringAsync(msg.message);
  }

  /** Opciones del menú (tres puntos en web, mantener presionado en el teléfono). */
  function menuOptions(msg: any) {
    const isMine = msg.sender_id === user?.id;
    const options: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }[] = [];

    if (isMine && (msg.message || msg.attachment_path)) {
      options.push({
        icon: "create-outline",
        label: msg.message ? "Editar" : "Agregar texto",
        onPress: () => startEdit(msg),
      });
    }
    if (msg.message) {
      options.push({ icon: "copy-outline", label: "Copiar texto", onPress: () => copyMessage(msg) });
    }
    if (msg.attachment_path) {
      options.push({ icon: "download-outline", label: "Descargar", onPress: () => openFile(msg) });
    }
    if (isMine) {
      options.push({ icon: "trash-outline", label: "Eliminar", danger: true, onPress: () => setMessageToDelete(msg) });
    }
    return options;
  }

  function renderAttachment(item: any, isMine: boolean) {
    const url = item.attachment_path ? mediaUrls[item.attachment_path] : undefined;

    if (item.attachment_type === "image") {
      return (
        <Pressable
          onPress={() => url && setViewer({ type: "image", url, path: item.attachment_path, name: item.attachment_name })}
          onLongPress={() => setMenuMessage(item)}
        >
          {url ? (
            <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
          ) : (
            <View style={[styles.mediaImage, styles.mediaLoading]}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </Pressable>
      );
    }

    if (item.attachment_type === "video") {
      return (
        <Pressable
          onPress={() => url && setViewer({ type: "video", url, path: item.attachment_path, name: item.attachment_name })}
          onLongPress={() => setMenuMessage(item)}
          style={[styles.mediaImage, styles.videoTile]}
        >
          {url ? (
            <View style={styles.playCircle}>
              <Ionicons name="play" size={28} color="#1B4079" />
            </View>
          ) : (
            <ActivityIndicator color="#fff" />
          )}
          <View style={styles.videoLabel}>
            <Ionicons name="videocam" size={14} color="#fff" />
            <Text style={styles.videoLabelText}>{formatBytes(item.attachment_size) || "Video"}</Text>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={() => openFile(item)}
        onLongPress={() => setMenuMessage(item)}
        style={[styles.fileCard, isMine ? styles.fileCardMine : styles.fileCardOther]}
      >
        <View style={[styles.fileIcon, isMine ? styles.fileIconMine : styles.fileIconOther]}>
          <Ionicons name="document-text" size={22} color={isMine ? "#324F40" : "#fff"} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.fileName, !isMine && styles.textDark]} numberOfLines={2}>
            {item.attachment_name ?? "Archivo"}
          </Text>
          <Text style={[styles.fileMeta, !isMine && styles.textMuted]}>
            {formatBytes(item.attachment_size)} · Toca para abrir
          </Text>
        </View>
      </Pressable>
    );
  }

  if (loading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#324F40" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => otherId && router.push(`/usuario/${otherId}`)}
          disabled={!otherId}
        >
          {otherAvatar && <Image source={{ uri: otherAvatar }} style={styles.headerAvatar} />}
          <Text style={styles.headerTitle}>{otherName}</Text>
        </TouchableOpacity>

        <View style={styles.headerRight} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={
          uploadingCount > 0 ? (
            <View style={[styles.messageWrapper, styles.ownWrapper]}>
              <View style={[styles.messageRow, styles.ownMessage, styles.uploadingRow]}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.messageText}>
                  {uploadingCount === 1 ? "Enviando archivo..." : `Enviando ${uploadingCount} archivos...`}
                </Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          const hasAttachment = !!item.attachment_path;
          // En web: tres puntitos que aparecen al pasar el cursor por el mensaje.
          const dots = isWeb ? (
            <TouchableOpacity
              onPress={() => setMenuMessage(item)}
              style={[
                styles.dotsButton,
                hoveredId === item.id || menuMessage?.id === item.id ? styles.dotsVisible : styles.dotsHidden,
              ]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#324F40" />
            </TouchableOpacity>
          ) : null;
          return (
            <Pressable
              onHoverIn={() => setHoveredId(item.id)}
              onHoverOut={() => setHoveredId((h) => (h === item.id ? null : h))}
              style={[styles.messageWrapper, isMine ? styles.ownWrapper : styles.otherWrapper]}
            >
              {!isMine && otherAvatar && <Image source={{ uri: otherAvatar }} style={styles.bubbleAvatar} />}
              {isMine && dots}
              <Pressable
                onLongPress={() => setMenuMessage(item)}
                delayLongPress={350}
                style={[
                  styles.messageRow,
                  isMine ? styles.ownMessage : styles.otherMessage,
                  hasAttachment && styles.attachmentRow,
                ]}
              >
                {hasAttachment && renderAttachment(item, isMine)}
                {item.message ? (
                  <Text style={[styles.messageText, !isMine && styles.textDark, hasAttachment && styles.caption]}>
                    {item.message}
                  </Text>
                ) : null}
                <Text style={[styles.messageTime, !isMine && styles.textMuted, hasAttachment && styles.caption]}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : ''}
                  {item.edited_at ? " · editado" : ""}
                </Text>
              </Pressable>
              {!isMine && dots}
            </Pressable>
          );
        }}
      />

      {editingMessage && (
        <View style={styles.editBanner}>
          <Ionicons name="create-outline" size={18} color="#324F40" />
          <View style={{ flex: 1 }}>
            <Text style={styles.editBannerTitle}>Editando mensaje</Text>
            <Text style={styles.editBannerText} numberOfLines={1}>
              {editingMessage.message || attachmentPreview(editingMessage.attachment_type, editingMessage.attachment_name)}
            </Text>
          </View>
          <TouchableOpacity onPress={cancelEdit} style={styles.editBannerClose}>
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        {!editingMessage && (
          <TouchableOpacity style={styles.attachBtn} onPress={() => setAttachMenuVisible(true)}>
            <Ionicons name="add" size={26} color="#324F40" />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={editingMessage ? "Edita tu mensaje..." : "Escribe un mensaje..."}
          onSubmitEditing={sendMessage}
          onKeyPress={(e: any) => {
            if (isWeb && editingMessage && e.nativeEvent?.key === "Escape") cancelEdit();
          }}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendText}>{editingMessage ? "Guardar" : "Enviar"}</Text>
        </TouchableOpacity>
      </View>

      {/* Opciones del mensaje: tres puntos (web) o mantener presionado (teléfono) */}
      <Modal visible={!!menuMessage} transparent animationType="fade" onRequestClose={() => setMenuMessage(null)}>
        <Pressable
          style={[styles.sheetOverlay, isWeb && styles.menuOverlayWeb]}
          onPress={() => setMenuMessage(null)}
        >
          <Pressable style={isWeb ? styles.menuCard : styles.sheet} onPress={(e) => e.stopPropagation()}>
            {!isWeb && <View style={styles.sheetHandle} />}
            {menuMessage && (
              <Text style={styles.menuPreview} numberOfLines={2}>
                {menuMessage.message || attachmentPreview(menuMessage.attachment_type, menuMessage.attachment_name)}
              </Text>
            )}
            {menuMessage &&
              menuOptions(menuMessage).map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuMessage(null);
                    opt.onPress();
                  }}
                >
                  <Ionicons name={opt.icon} size={20} color={opt.danger ? "#EF3340" : "#324F40"} />
                  <Text style={[styles.menuItemText, opt.danger && styles.menuItemDanger]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Menú de adjuntos */}
      <Modal visible={attachMenuVisible} transparent animationType="fade" onRequestClose={() => setAttachMenuVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setAttachMenuVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Enviar archivo</Text>
            <View style={styles.sheetOptions}>
              <AttachOption icon="images" label="Galería" color="#324F40" onPress={pickFromGallery} />
              {Platform.OS !== "web" && (
                <AttachOption icon="camera" label="Cámara" color="#1B4079" onPress={takeWithCamera} />
              )}
              <AttachOption icon="document" label="Documento" color="#3b7dd8" onPress={pickDocument} />
            </View>
            <Text style={styles.sheetHint}>Fotos, videos y archivos de hasta 50 MB</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Visor de fotos y videos a pantalla completa */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerContainer}>
          {viewer?.type === "image" && (
            <Image source={{ uri: viewer.url }} style={styles.viewerMedia} resizeMode="contain" />
          )}
          {viewer?.type === "video" && <ChatVideo url={viewer.url} />}

          <View style={styles.viewerTopBar}>
            <TouchableOpacity
              style={styles.viewerButton}
              onPress={() => viewer && openFile({ attachment_path: viewer.path, attachment_name: viewer.name })}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.viewerButton} onPress={() => setViewer(null)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AppAlert
        visible={!!messageToDelete}
        type="error"
        title="¿Eliminar mensaje?"
        message={
          messageToDelete?.attachment_path
            ? "Se eliminará el mensaje y el archivo para ambos. Esta acción no se puede deshacer."
            : "Se eliminará el mensaje para ambos. Esta acción no se puede deshacer."
        }
        onClose={() => setMessageToDelete(null)}
        onConfirm={confirmDeleteMessage}
        confirmText="Eliminar"
      />

      <AppAlert
        visible={!!errorMsg}
        type="error"
        title="Ups"
        message={errorMsg ?? ""}
        onClose={() => setErrorMsg(null)}
      />
    </KeyboardAvoidingView>
  );
}

function imagePickerAssetToAttachment(a: ImagePicker.ImagePickerAsset): PickedAttachment {
  const isVideo = a.type === "video" || a.mimeType?.startsWith("video/");
  const ext = a.uri.split(".").pop()?.split("?")[0]?.toLowerCase();
  const fallbackExt = isVideo ? "mp4" : "jpg";
  const mimeType =
    a.mimeType ?? (isVideo ? `video/${ext === "mov" ? "quicktime" : ext || "mp4"}` : `image/${ext === "jpg" || !ext ? "jpeg" : ext}`);
  const name = a.fileName ?? `${isVideo ? "video" : "foto"}-${Date.now()}.${ext && ext.length <= 4 ? ext : fallbackExt}`;

  return { uri: a.uri, name, mimeType, size: a.fileSize, type: isVideo ? "video" : "image" };
}

function AttachOption({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sheetOption} onPress={onPress}>
      <View style={[styles.sheetOptionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text style={styles.sheetOptionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChatVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });

  return <VideoView player={player} style={styles.viewerMedia} nativeControls contentFit="contain" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1B4079',
    padding: 15,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { paddingHorizontal: 5 },
  backText: { color: '#FFFFFF', fontSize: 24 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  headerRight: { width: 30 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 10, marginTop: 8 },
  ownWrapper: { justifyContent: 'flex-end' },
  otherWrapper: { justifyContent: 'flex-start' },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 6 },
  messageRow: { padding: 12, borderRadius: 12, maxWidth: '80%' },
  ownMessage: { alignSelf: 'flex-end', backgroundColor: '#324F40' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  attachmentRow: { padding: 4 },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageText: { color: '#fff' },
  textDark: { color: '#1f2937' },
  textMuted: { color: '#6b7280' },
  caption: { paddingHorizontal: 8 },
  messageTime: { fontSize: 10, color: '#ddd', marginTop: 6, paddingBottom: 2 },
  mediaImage: { width: 220, height: 220, borderRadius: 10, backgroundColor: '#1f2937' },
  mediaLoading: { justifyContent: 'center', alignItems: 'center' },
  videoTile: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1B4079', height: 160 },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoLabel: { position: 'absolute', left: 10, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  videoLabelText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, minWidth: 200 },
  fileCardMine: { backgroundColor: 'rgba(255,255,255,0.12)' },
  fileCardOther: { backgroundColor: '#fff' },
  fileIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fileIconMine: { backgroundColor: '#fff' },
  fileIconOther: { backgroundColor: '#324F40' },
  fileName: { color: '#fff', fontWeight: '700' },
  fileMeta: { color: '#ddd', fontSize: 11, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef3e3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  sendBtn: { marginLeft: 8, backgroundColor: '#324F40', paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center', borderRadius: 8 },
  sendText: { color: '#fff', fontWeight: '700' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    borderTopWidth: 4,
    borderTopColor: '#324F40',
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B4079', marginBottom: 16 },
  sheetOptions: { flexDirection: 'row', justifyContent: 'space-around' },
  sheetOption: { alignItems: 'center', gap: 8 },
  sheetOptionIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  sheetOptionLabel: { color: '#1f2937', fontWeight: '600' },
  sheetHint: { textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 18 },
  dotsButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dotsVisible: { opacity: 1 },
  dotsHidden: { opacity: 0 },
  menuOverlayWeb: { justifyContent: 'center', alignItems: 'center' },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 8,
    width: 260,
    borderTopWidth: 4,
    borderTopColor: '#324F40',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  menuPreview: { color: '#6b7280', fontSize: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontSize: 15, color: '#1f2937', fontWeight: '600' },
  menuItemDanger: { color: '#EF3340' },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eef3e3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#324F40',
  },
  editBannerTitle: { color: '#324F40', fontWeight: '700', fontSize: 13 },
  editBannerText: { color: '#6b7280', fontSize: 12 },
  editBannerClose: { padding: 4 },
  viewerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerMedia: { width: '100%', height: '100%' },
  viewerTopBar: { position: 'absolute', top: 45, right: 15, flexDirection: 'row', gap: 10 },
  viewerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
