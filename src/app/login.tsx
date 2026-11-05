import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppAlert, { type AppAlertType } from "../components/AppAlert";
import { signInWithProvider, type OAuthProvider } from "../lib/oauth";
import { validarContrasena } from "../lib/password";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

const PRIVACY_POLICY_URL = "https://pamelapostili.github.io/uniLifePoliticas/";

export default function LoginScreen() {
  const { user, loading: userLoading } = useUser();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message?: string; type: AppAlertType } | null>(null);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  function showError(title: string, message?: string, type: AppAlertType = "error") {
    setAlertInfo({ title, message, type });
  }

  useEffect(() => {
    if (!userLoading && user) {
      router.replace("/");
    }
  }, [user, userLoading]);

  function openPrivacyPolicy() {
    WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  }

  function showPrivacyRequired() {
    showError(
      "Acepta las políticas de privacidad",
      "Para crear tu cuenta necesitas aceptar las políticas de privacidad de UniLife."
    );
  }

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

    const errorContrasena = validarContrasena(password);
    if (errorContrasena) {
      showError("Contraseña insegura", errorContrasena);
      return;
    }

    const isEmail = isValidEmail(emailOrPhone);
    const isPhone = isValidPhone(emailOrPhone);

    if (!isEmail && !isPhone) {
      showError("Formato inválido", "Ingresa un correo o número válido.");
      return;
    }

    if (!acceptedPrivacy) {
      showPrivacyRequired();
      return;
    }

    // Se guarda en user_metadata cuándo aceptó las políticas, como constancia.
    const metadata = {
      full_name: name || undefined,
      privacy_accepted_at: new Date().toISOString(),
    };

    setLoading(true);
    const { data, error } = isEmail
      ? await supabase.auth.signUp({
          email: emailOrPhone,
          password,
          options: { data: metadata },
        })
      : await supabase.auth.signUp({
          phone: emailOrPhone,
          password,
          options: { data: metadata },
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
      // Supabase no distingue "cuenta nueva pendiente de confirmar" de "la
      // cuenta ya existe y está confirmada" con un error explícito (por
      // diseño, para no revelar qué correos están registrados). La única
      // pista es que "identities" viene vacío cuando el correo/teléfono ya
      // tenía una cuenta confirmada.
      const yaExistia = (data.user.identities?.length ?? 0) === 0;

      setIsSignUp(false);
      setPassword("");
      setConfirmPassword("");

      if (yaExistia) {
        showError(
          "Esa cuenta ya existe",
          isEmail
            ? "Ya hay una cuenta registrada con ese correo. Inicia sesión en su lugar."
            : "Ya hay una cuenta registrada con ese teléfono. Inicia sesión en su lugar.",
          "info"
        );
        return;
      }

      // Requiere confirmación por correo/SMS antes de poder iniciar sesión.
      // No se puede crear el perfil todavía: sin sesión activa, Supabase (RLS)
      // rechaza la escritura. El perfil se crea en el primer login real
      // (ver fetchProfile en user-context.tsx).
      showError(
        "Confirma tu cuenta",
        isEmail
          ? "Revisa tu correo y confirma tu cuenta antes de iniciar sesión."
          : "Revisa tu teléfono y confirma tu cuenta antes de iniciar sesión.",
        "info"
      );
    }
  }

  async function handleOAuthPress(provider: OAuthProvider) {
    // En modo registro, Google/Apple también crean la cuenta: mismo requisito.
    if (isSignUp && !acceptedPrivacy) {
      showPrivacyRequired();
      return;
    }

    setOauthLoading(provider);
    try {
      await signInWithProvider(provider);
      // La sesión (si el usuario completó el login) llega vía onAuthStateChange
      // en user-context.tsx, que a su vez dispara el useEffect de redirección arriba.
    } catch (err: any) {
      showError("No se pudo iniciar sesión", err?.message);
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-circle-outline" size={56} color="#324F40" />
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
          <Text style={styles.passwordHint}>
            Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo. Evita secuencias fáciles (1234, abcd).
          </Text>
        )}

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
          <View style={styles.privacyRow}>
            <TouchableOpacity
              onPress={() => setAcceptedPrivacy((v) => !v)}
              style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedPrivacy }}
              accessibilityLabel="Acepto las políticas de privacidad"
              hitSlop={8}
            >
              {acceptedPrivacy && <Ionicons name="checkmark" size={16} color="#fff" />}
            </TouchableOpacity>
            <Text style={styles.privacyText}>
              <Text onPress={() => setAcceptedPrivacy((v) => !v)}>Acepto las </Text>
              <Text style={styles.privacyLink} onPress={openPrivacyPolicy}>
                políticas de privacidad
              </Text>
              <Text onPress={() => setAcceptedPrivacy((v) => !v)}> de UniLife</Text>
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, isSignUp && !acceptedPrivacy && styles.buttonDisabled]}
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

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o continúa con</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.socialButton}
          onPress={() => handleOAuthPress("google")}
          disabled={oauthLoading !== null}
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator color="#374151" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#374151" style={styles.socialIcon} />
              <Text style={styles.socialButtonText}>Continuar con Google</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={() => handleOAuthPress("apple")}
            disabled={oauthLoading !== null}
          >
            {oauthLoading === "apple" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color="#fff" style={styles.socialIcon} />
                <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continuar con Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* En registro ya está la casilla; aquí cubre a quien entra por primera vez con Google/Apple. */}
        {!isSignUp && (
          <Text style={styles.legalNote}>
            Al continuar aceptas las{" "}
            <Text style={styles.privacyLink} onPress={openPrivacyPolicy}>
              políticas de privacidad
            </Text>
          </Text>
        )}
      </View>

      <AppAlert
        visible={alertInfo !== null}
        type={alertInfo?.type}
        title={alertInfo?.title ?? ""}
        message={alertInfo?.message}
        onClose={() => setAlertInfo(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#F4F5F0",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
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
  passwordHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: -6,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#324F40",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#324F40",
    borderColor: "#324F40",
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  legalNote: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  privacyLink: {
    color: "#324F40",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  note: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 12,
    fontSize: 12,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#94a3b8",
    fontSize: 12,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    color: "#374151",
    fontWeight: "600",
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
  },
});
