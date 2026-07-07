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
    if (!emailOrPhone || !password) {
      Alert.alert("Completa los campos", "Ingresa tu correo/telefono y contraseña.");
      return;
    }

    setLoading(true);

    const credentials: any = {};
    if (isValidEmail(emailOrPhone)) {
      credentials.email = emailOrPhone;
    } else if (isValidPhone(emailOrPhone)) {
      credentials.phone = emailOrPhone;
    } else {
      setLoading(false);
      Alert.alert("Formato inválido", "Ingresa un correo o número válido.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      ...credentials,
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("No se pudo iniciar sesión", error.message);
      return;
    }

    router.replace("/");
  }

  async function handleSignUp() {
    if (!emailOrPhone || !password || !confirmPassword) {
      Alert.alert("Completa los campos", "Rellena todos los campos de registro.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Contraseñas no coinciden", "Verifica que las contraseñas coincidan.");
      return;
    }

    setLoading(true);

    try {
      let result: any;

      if (isValidEmail(emailOrPhone)) {
        result = await supabase.auth.signUp({ email: emailOrPhone, password });
      } else if (isValidPhone(emailOrPhone)) {
        result = await supabase.auth.signUp({ phone: emailOrPhone, password });
      } else {
        setLoading(false);
        Alert.alert("Formato inválido", "Ingresa un correo o número válido.");
        return;
      }

      const { data, error } = result;
      if (error) {
        Alert.alert("No se pudo crear la cuenta", error.message);
        setLoading(false);
        return;
      }

      // If a user object is returned, create a profile row in the DB.
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          full_name: name || undefined,
          avatar_url: undefined,
        });

        Alert.alert("Cuenta creada", "Tu cuenta ha sido creada correctamente.");
        // If signup returned a session, navigate inmediatly.
        if (data?.session) {
          router.replace("/");
        }
      } else {
        // No immediate user (email confirmation required)
        Alert.alert(
          "Registro registrado",
          "Revisa tu correo o teléfono para completar la verificación."
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? String(e));
    } finally {
      setLoading(false);
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
            <Text style={styles.buttonText}>{isSignUp ? "Crear cuenta" : "Entrar"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp((s) => !s)} style={{ marginTop: 12 }}>
          <Text style={[styles.note, { textDecorationLine: 'underline' }]}> 
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
