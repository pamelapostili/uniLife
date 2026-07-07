import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import EmojiSelector from 'react-native-emoji-selector';
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  user?: {
    email: string;
  };
};

export default function ChatScreen() {
  const { name, other_user, chatId } = useLocalSearchParams();
  const { user } = useUser();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const chatIdParam = chatId as string;

  // Cargar mensajes
useEffect(() => {
  const fetchMessages = async () => {
    if (!chatIdParam) return;

    console.log('📥 Cargando mensajes para chat:', chatIdParam);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatIdParam)
      .order("created_at", { ascending: true });

    if (error) {
      console.error('❌ Error al cargar mensajes:', error);
    } else {
      console.log('✅ Mensajes cargados:', data?.length);
      setMessages(data || []);
    }
    setLoading(false);
  };

  fetchMessages();

  // Suscripción en tiempo real
  console.log('🔌 Suscribiendo a mensajes...');
  const subscription = supabase
    .channel(`messages:${chatIdParam}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatIdParam}`,
      },
      (payload) => {
        console.log('📡 Nuevo mensaje recibido:', payload);
        setMessages(prev => {
          const newMessages = [...prev, payload.new as Message];
          console.log('📊 Total mensajes:', newMessages.length);
          return newMessages;
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    )
    .subscribe((status) => {
      console.log('📡 Estado de suscripción:', status);
    });

  return () => {
    console.log('🔌 Desuscribiendo...');
    subscription.unsubscribe();
  };
}, [chatIdParam]);

const sendMessage = async () => {
  if (!newMessage.trim() || !user || !chatIdParam) return;

  setSending(true);
  console.log('📤 Enviando mensaje:', newMessage.trim());
  console.log('📌 Chat ID:', chatIdParam);
  console.log('👤 User ID:', user.id);

  const { data, error } = await supabase.from("messages").insert({
    chat_id: chatIdParam,
    sender_id: user.id,
    message: newMessage.trim(),
  }).select(); // ← Añadimos .select() para ver el resultado

  if (error) {
    console.error('❌ Error al enviar:', error);
    setSending(false);
    return;
  }

  console.log('✅ Mensaje enviado:', data);
  setNewMessage("");
  
  // Actualizar último mensaje en la tabla chats
  const { error: updateError } = await supabase
    .from("chats")
    .update({
      last_message: newMessage.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatIdParam);

  if (updateError) {
    console.error('❌ Error al actualizar chat:', updateError);
  }

  setSending(false);
  setShowEmojis(false);
};
  // Agregar emoji al mensaje
  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojis(false);
  };

  // Formatear fecha
  const formatMessageTime = (date: string) => {
    const msgDate = new Date(date);
    const now = new Date();
    const diff = now.getTime() - msgDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return msgDate.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return msgDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name || other_user || "Chat"}</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageWrapper,
            item.sender_id === user?.id ? styles.myMessageWrapper : styles.otherMessageWrapper
          ]}>
            <View style={[
              styles.messageContainer,
              item.sender_id === user?.id ? styles.myMessage : styles.otherMessage
            ]}>
              <Text style={[
                styles.messageText,
                item.sender_id === user?.id ? styles.myMessageText : styles.otherMessageText
              ]}>
                {item.message}
              </Text>
              <Text style={styles.messageTime}>
                {formatMessageTime(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {showEmojis && (
        <View style={styles.emojiContainer}>
          <EmojiSelector
            onEmojiSelected={addEmoji}
            columns={8}
            showSearchBar={false}
            showSectionTitles={false}
          />
        </View>
      )}

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
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F1",
  },
  header: {
    backgroundColor: "#1B4079",
    padding: 15,
    paddingTop: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    paddingHorizontal: 5,
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 24,
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
    backgroundColor: "#b9d27b",
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
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    transform: [{ rotate: '45deg' }],
  },
  emojiContainer: {
    height: 300,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
});