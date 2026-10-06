import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type AppAlertType = "error" | "success" | "info";

type AppAlertProps = {
  visible: boolean;
  type?: AppAlertType;
  title: string;
  message?: string;
  onClose: () => void;
};

const THEMES: Record<AppAlertType, { color: string; light: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error: { color: "#EF3340", light: "#fdeceb", icon: "close-circle" },
  success: { color: "#324F40", light: "#eef3e3", icon: "checkmark-circle" },
  info: { color: "#3b7dd8", light: "#e8f1fc", icon: "information-circle" },
};

/**
 * Reemplazo temático de Alert.alert/window.alert: modal animado con color e
 * ícono según el tipo de mensaje, en vez de la caja de sistema genérica.
 */
export default function AppAlert({ visible, type = "error", title, message, onClose }: AppAlertProps) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const theme = THEMES[type];

  useEffect(() => {
    if (visible) {
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 9 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }], borderTopColor: theme.color }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={[styles.iconWrap, { backgroundColor: theme.light }]}>
              <Ionicons name={theme.icon} size={36} color={theme.color} />
            </View>

            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <TouchableOpacity style={[styles.button, { backgroundColor: theme.color }]} onPress={onClose}>
              <Text style={styles.buttonText}>Entendido</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20,20,19,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 24,
    borderTopWidth: 6,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#141413",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: "#5b5a54",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 22,
  },
  button: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
