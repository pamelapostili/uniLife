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
  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingAuthType, setPendingAuthType] = useState<"email" | "sms" | null>(null);
  const [pendingContact, setPendingContact] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  function showDebug(title: string, message?: string) {
    const msg = message ?? "";
    try {
      // On web, Alert.alert may not show as expected; use window.alert as fallback
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n${msg}`);
      } else {
        Alert.alert(title, msg);
      }
    } catch (e) {
      // ignore
    }
    console.log('[DEBUG]', title, message);
    setDebugMessage(`${title}: ${msg}`);
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

  async function handleLogin() {
    if (!emailOrPhone) {
      showDebug("Completa los campos", "Ingresa tu correo o teléfono.");
      return;
    }

    if (isValidEmail(emailOrPhone)) {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOtp({
        email: emailOrPhone,
      });
      setLoading(false);

      if (error) {
        showDebug("No se pudo enviar el código", error.message);
        return;
      }

      setPendingAuthType("email");
      setPendingContact(emailOrPhone);
      setVerificationPending(true);
      showDebug("Código enviado", "Revisa tu correo y escribe el código aquí.");
    } else if (isValidPhone(emailOrPhone)) {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: emailOrPhone,
      });
      setLoading(false);

      if (error) {
        showDebug("No se pudo enviar el código", error.message);
        return;
      }

      setPendingAuthType("sms");
      setPendingContact(emailOrPhone);
      setVerificationPending(true);
      showDebug("Código enviado", "Revisa tu teléfono y escribe el código aquí.");
    } else {
      showDebug("Formato inválido", "Ingresa un correo o número válido.");
    }
  }

  async function handleSignUp() {
    if (!emailOrPhone || !password || !confirmPassword) {
      showDebug("Completa los campos", "Rellena todos los campos de registro.");
      return;
    }

    if (password !== confirmPassword) {
      showDebug("Contraseñas no coinciden", "Verifica que las contraseñas coincidan.");
      return;
    }

    if (isValidEmail(emailOrPhone)) {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOtp({
        email: emailOrPhone,
        options: { shouldCreateUser: true },
      });
      setLoading(false);

      if (error) {
        showDebug("No se pudo enviar el código", error.message);
        return;
      }

      setPendingAuthType("email");
      setPendingContact(emailOrPhone);
      setVerificationPending(true);
      showDebug("Código enviado", "Revisa tu correo y escribe el código para completar el registro.");
    } else if (isValidPhone(emailOrPhone)) {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: emailOrPhone,
        options: { shouldCreateUser: true },
      });
      setLoading(false);

      if (error) {
        showDebug("No se pudo enviar el código", error.message);
        return;
      }

      setPendingAuthType("sms");
      setPendingContact(emailOrPhone);
      setVerificationPending(true);
      showDebug("Código enviado", "Revisa tu teléfono y escribe el código para completar el registro.");
    } else {
      showDebug("Formato inválido", "Ingresa un correo o número válido.");
    }
  }

  async function handleVerifyCode() {
    if (!verificationCode) {
      showDebug("Ingresa el código", "Escribe el código que recibiste.");
      return;
    }

    setLoading(true);
    const otpPayload: any = {
      type: pendingAuthType === "sms" ? "sms" : "email",
      token: verificationCode,
    };
    if (pendingAuthType === "sms") {
      otpPayload.phone = pendingContact;
    } else if (pendingAuthType === "email") {
      otpPayload.email = pendingContact;
    }

    const { data, error } = await supabase.auth.verifyOtp(otpPayload);
    setLoading(false);

    if (error) {
      showDebug("Código inválido", error.message);
      return;
    }

    setVerificationPending(false);
    setVerificationCode("");
    setPendingAuthType(null);
    setPendingContact("");

    if (data?.session) {
      const userId = data.session.user.id;
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: name || undefined,
        avatar_url: undefined,
      });

      if (upsertError) {
        showDebug("Perfil no creado", upsertError.message);
      } else {
        showDebug("Cuenta verificada", "Tu cuenta y perfil se crearon correctamente.");
      }

      router.replace("/");
    } else {
      showDebug("Verificación completada", "La verificación fue correcta.");
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

        {debugMessage ? (
          <View style={{ padding: 8, backgroundColor: '#fff3bf', borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ color: '#856404' }}>{debugMessage}</Text>
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
          onPress={verificationPending ? handleVerifyCode : isSignUp ? handleSignUp : handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {verificationPending ? "Verificar código" : isSignUp ? "Crear cuenta" : "Enviar código"}
            </Text>
          )}
        </TouchableOpacity>

        {verificationPending ? (
          <TextInput
            style={styles.input}
            placeholder="Código de verificación"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
          />
        ) : null}

        <TouchableOpacity onPress={() => setIsSignUp((s) => !s)} style={{ marginTop: 12 }}>
          <Text style={[styles.note, { textDecorationLine: 'underline' }]}> 
            {verificationPending
              ? "Volver" 
              : isSignUp
              ? "¿Ya tienes cuenta? Iniciar sesión"
              : "¿No tienes cuenta? Crear cuenta"}
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
