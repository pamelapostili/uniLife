import { useEffect, useState, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useUser } from "../../../lib/user-context";

export default function ChatThread() {
  const { user, loading } = useUser();
  const params = useLocalSearchParams();
  const router = useRouter();
  const chatId = params.id as string | undefined;
  const [messages, setMessages] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
  }, [loading, user]);

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
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.sender_id === user?.id ? styles.ownMessage : styles.otherMessage]}>
            <Text style={styles.messageText}>{item.message}</Text>
            <Text style={styles.messageTime}>{item.created_at ? new Date(item.created_at).toLocaleTimeString() : ''}</Text>
          </View>
        )}
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
  messageRow: { margin: 10, padding: 12, borderRadius: 12, maxWidth: '80%' },
  ownMessage: { alignSelf: 'flex-end', backgroundColor: '#6f7e49' },
  otherMessage: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  messageText: { color: '#fff' },
  messageTime: { fontSize: 10, color: '#ddd', marginTop: 6 },
  inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  input: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  sendBtn: { marginLeft: 8, backgroundColor: '#6f7e49', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  sendText: { color: '#fff', fontWeight: '700' },
});
