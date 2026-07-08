import { Ionicons } from "@expo/vector-icons";
import Checkbox from "expo-checkbox";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

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
    if (!name || !lastName || !emailOrPhone || !password || !confirmPassword) {
        Alert.alert("Completa los campos", "Rellena todos los campos de registro.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Contraseñas no coinciden", "Verifica que las contraseñas coincidan.");
      return;
    }

if (!acceptedPrivacy) {
  Alert.alert(
    "Políticas de Privacidad",
    "Debes aceptar las Políticas de Privacidad para crear una cuenta."
  );
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
  console.log(error);
  Alert.alert("Error", JSON.stringify(error));
  setLoading(false);
  return;
}

      // If a user object is returned, create a profile row in the DB.
      const userId = data?.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          full_name: `${name} ${lastName}` || undefined,
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
          <Ionicons name="person-circle-outline" size={56} color="#b9d27b" />
        </View>

        <Text style={styles.title}>{isSignUp ? "Crear cuenta" : "Iniciar Sesión"}</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Regístrate a UniLife para conectar con comunidad UTP" : "Accede a UniLife para conectar con comunidad UTP"}
        </Text>

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            value={name}
            onChangeText={setName}
          />
        )}

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Apellidos"
            value={lastName}
            onChangeText={setLastName}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Correo Electrónico"
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

{isSignUp && (
  <View style={styles.privacyContainer}>
    <Checkbox
      value={acceptedPrivacy}
      onValueChange={setAcceptedPrivacy}
      color={acceptedPrivacy ? "#b9d27b" : undefined}
    />

    <Text style={styles.privacyText}>
      He leído y acepto las{" "}
      <Text
        style={styles.link}
        onPress={() =>
          Linking.openURL(
            "https://pamelapostili.github.io/uniLifePoliticas/"
          )
        }
      >
        Políticas de Privacidad
      </Text>
    </Text>
  </View>
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
    backgroundColor: "#b9d27b",
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
  privacyContainer: {
  flexDirection: "row",
  alignItems: "flex-start",
  marginBottom: 15,
},

privacyText: {
  flex: 1,
  marginLeft: 10,
  color: "#555",
  fontSize: 13,
  lineHeight: 18,
},

link: {
  color: "#4A90E2",
  textDecorationLine: "underline",
  fontWeight: "600",
},
});