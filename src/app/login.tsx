import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

export default function LoginScreen() {
  const { user, loading: userLoading } = useUser();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  function showError(title: string, message?: string) {
    const msg = message ?? "";
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
    setInfoMessage(`${title}: ${msg}`);
  }

  useEffect(() => {
    if (!userLoading && user) {
      router.replace("/");
    }
  }, [user, userLoading]);

  function isValidEmail(value: string) {
    return /\S+@\S+\.\S+/.test(value);
  }

  function isValidPhone(value: string) {
    return /^\+?[0-9]{7,15}$/.test(value.replace(/\s+/g, ""));
  }

  // Crea o actualiza la fila del usuario en la tabla "profiles" con datos reales.
  async function ensureProfile(userId: string, fullName?: string) {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName && fullName.trim().length > 0 ? fullName.trim() : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("[profiles.upsert] ", error.message);
    }
  }

  async function handleLogin() {
    if (!emailOrPhone || !password) {
      showError("Completa los campos", "Ingresa tu correo/teléfono y tu contraseña.");
      return;
    }

    setLoading(true);
    const { data, error } = isValidEmail(emailOrPhone)
      ? await supabase.auth.signInWithPassword({ email: emailOrPhone, password })
      : isValidPhone(emailOrPhone)
      ? await supabase.auth.signInWithPassword({ phone: emailOrPhone, password })
      : { data: null, error: { message: "Ingresa un correo o número válido." } as any };
    setLoading(false);

    if (error) {
      showError("No se pudo iniciar sesión", error.message);
      return;
    }

    if (data?.user) {
      await ensureProfile(data.user.id, data.user.user_metadata?.full_name);
      router.replace("/");
    }
  }

  async function handleSignUp() {
    if (!emailOrPhone || !password || !confirmPassword) {
      showError("Completa los campos", "Rellena todos los campos de registro.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Contraseñas no coinciden", "Verifica que las contraseñas coincidan.");
      return;
    }

    if (password.length < 6) {
      showError("Contraseña muy corta", "Usa al menos 6 caracteres.");
      return;
    }

    const isEmail = isValidEmail(emailOrPhone);
    const isPhone = isValidPhone(emailOrPhone);

    if (!isEmail && !isPhone) {
      showError("Formato inválido", "Ingresa un correo o número válido.");
      return;
    }

    setLoading(true);
    const { data, error } = isEmail
      ? await supabase.auth.signUp({
          email: emailOrPhone,
          password,
          options: { data: { full_name: name || undefined } },
        })
      : await supabase.auth.signUp({
          phone: emailOrPhone,
          password,
          options: { data: { full_name: name || undefined } },
        });
    setLoading(false);

    if (error) {
      showError("No se pudo crear la cuenta", error.message);
      return;
    }

    if (data?.session && data.user) {
      // Confirmación automática habilitada: ya hay sesión activa.
      await ensureProfile(data.user.id, name);
      router.replace("/");
      return;
    }

    if (data?.user && !data.session) {
      // Requiere confirmación por correo/SMS antes de poder iniciar sesión.
      await ensureProfile(data.user.id, name);
      setIsSignUp(false);
      setPassword("");
      setConfirmPassword("");
      showError(
        "Confirma tu cuenta",
        isEmail
          ? "Revisa tu correo y confirma tu cuenta antes de iniciar sesión."
          : "Revisa tu teléfono y confirma tu cuenta antes de iniciar sesión."
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-circle-outline" size={56} color="#6f7e49" />
        </View>

        <Text style={styles.title}>{isSignUp ? "Crear cuenta" : "Inicia sesión"}</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Regístrate y conecta con la comunidad" : "Accede a UniLife con tu cuenta de Supabase"}
        </Text>

        {infoMessage ? (
          <View style={{ padding: 8, backgroundColor: "#fff3bf", borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ color: "#856404" }}>{infoMessage}</Text>
          </View>
        ) : null}

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Nombre completo (opcional)"
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico o teléfono"
          autoCapitalize="none"
          keyboardType="email-address"
          value={emailOrPhone}
          onChangeText={setEmailOrPhone}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={isSignUp ? handleSignUp : handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? "Crear cuenta" : "Iniciar sesión"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp((s) => !s)} style={{ marginTop: 12 }}>
          <Text style={[styles.note, { textDecorationLine: "underline" }]}>
            {isSignUp ? "¿Ya tienes cuenta? Iniciar sesión" : "¿No tienes cuenta? Crear cuenta"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#f7f8fa",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconWrap: {
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: "#64748b",
    textAlign: "center",
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#6f7e49",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  note: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 12,
    fontSize: 12,
  },
});
