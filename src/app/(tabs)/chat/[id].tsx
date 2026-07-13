import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../../lib/supabase";
import { useUser } from "../../../lib/user-context";

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

// Emojis organizados por categorías
const emojiCategories = [
  { name: 'Caras', emojis: ['😀', '😂', '😊', '😍', '😎', '😢', '😡', '😅', '😉', '😭', '😇', '🥳'] },
  { name: 'Gestos', emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '🤗', '🤔', '🤷', '🙋'] },
  { name: 'Corazones', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💗'] },
  { name: 'Símbolos', emojis: ['⭐', '🌟', '🔥', '💯', '✨', '🎉', '🎊', '🎈', '🎁', '🏆'] },
];

export default function ChatScreen() {
  const { id, name, other_user } = useLocalSearchParams();
  const { user } = useUser();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const flatListRef = useRef<FlatList<Message> | null>(null);

  const chatId = id as string;

  // Cargar mensajes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!chatId) return;

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();

    // Suscripción en tiempo real
    const subscription = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

  // Enviar mensaje
  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chatId) return;

    setSending(true);

    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: user.id,
      message: newMessage.trim(),
    });

    if (error) {
      console.error("Error sending message:", error);
      setSending(false);
      return;
    }

    await supabase
      .from("chats")
      .update({
        last_message: newMessage.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);

    setNewMessage("");
    setSending(false);
    setShowEmojis(false);
  };

  // Agregar emoji
  const addEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
  };

  // Formatear hora
  const formatMessageTime = (date: string) => {
    const msgDate = new Date(date);
    return msgDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* HEADER - Nombre del contacto */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{name || other_user || "Chat"}</Text>
          <View style={styles.headerRight} />
        </View>

        {/* MENSAJES */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageWrapper,
                item.sender_id === user?.id ? styles.myMessageWrapper : styles.otherMessageWrapper,
              ]}
            >
              <View
                style={[
                  styles.messageContainer,
                  item.sender_id === user?.id ? styles.myMessage : styles.otherMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    item.sender_id === user?.id ? styles.myMessageText : styles.otherMessageText,
                  ]}
                >
                  {item.message}
                </Text>
                <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>💬 No hay mensajes aún</Text>
              <Text style={styles.emptyMessagesSub}>Envía el primer mensaje</Text>
            </View>
          )}
        />

        {/* SELECTOR DE EMOJIS */}
        {showEmojis && (
          <View style={styles.emojiContainer}>
            <FlatList
              data={emojiCategories}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <View>
                  <Text style={styles.emojiCategoryTitle}>{item.name}</Text>
                  <View style={styles.emojiPaletteContainer}>
                    {item.emojis.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiItem}
                        onPress={() => addEmoji(emoji)}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* INPUT */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.emojiButton} 
            onPress={() => setShowEmojis(!showEmojis)}
          >
            <Text style={styles.emojiButtonText}>😊</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            editable={!sending}
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7F1",
  },
  container: {
    flex: 1,
    backgroundColor: "#F4F7F1",
  },
  // HEADER
  header: {
    backgroundColor: "#1B4079",
    padding: 15,
    paddingTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    paddingHorizontal: 5,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 30,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    padding: 15,
    paddingBottom: 10,
  },
  messageWrapper: {
    marginBottom: 8,
  },
  myMessageWrapper: {
    alignItems: "flex-end",
  },
  otherMessageWrapper: {
    alignItems: "flex-start",
  },
  messageContainer: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  myMessage: {
    backgroundColor: "#b9d27b",
    borderBottomRightRadius: 5,
  },
  otherMessage: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#1B4079",
  },
  otherMessageText: {
    color: "#333",
  },
  messageTime: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    alignItems: "flex-end",
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },
  emojiButtonText: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: "#6f7e49",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  emojiContainer: {
    maxHeight: 250,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingHorizontal: 10,
  },
  emojiCategoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
    marginBottom: 4,
  },
  emojiPaletteContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emojiItem: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emojiText: {
    fontSize: 24,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyMessagesText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 8,
  },
  emptyMessagesSub: {
    fontSize: 14,
    color: "#999",
  },
});