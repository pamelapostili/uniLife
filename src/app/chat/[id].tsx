import { useEffect, useState, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../lib/user-context";

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
  const listRef = useRef<FlatList>(null);

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
        .select("id, chat_id, sender_id, message, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!error && data) {
        setMessages(data as any[]);
      }

      setFetching(false);
    })();
  }, [chatId, user]);

  async function sendMessage() {
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
      .select("id, chat_id, sender_id, message, created_at");

    if (!error && data?.length) {
      setMessages((m) => [...m, data[0]]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);

      await supabase
        .from("chats")
        .update({ last_message: messageText, updated_at: new Date().toISOString() })
        .eq("id", chatId);
    } else if (error) {
      console.warn("[messages.insert] ", error.message);
    }
  }

  if (loading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
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
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return (
            <View style={[styles.messageWrapper, isMine ? styles.ownWrapper : styles.otherWrapper]}>
              {!isMine && otherAvatar && <Image source={{ uri: otherAvatar }} style={styles.bubbleAvatar} />}
              <View style={[styles.messageRow, isMine ? styles.ownMessage : styles.otherMessage]}>
                <Text style={styles.messageText}>{item.message}</Text>
                <Text style={styles.messageTime}>{item.created_at ? new Date(item.created_at).toLocaleTimeString() : ''}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Escribe un mensaje..." />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
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
  ownMessage: { alignSelf: 'flex-end', backgroundColor: '#6f7e49' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  messageText: { color: '#fff' },
  messageTime: { fontSize: 10, color: '#ddd', marginTop: 6 },
  inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  input: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  sendBtn: { marginLeft: 8, backgroundColor: '#6f7e49', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  sendText: { color: '#fff', fontWeight: '700' },
});
