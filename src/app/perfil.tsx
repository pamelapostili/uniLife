import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import AppAlert, { type AppAlertType } from "../components/AppAlert";
import { CATEGORIAS } from "../lib/categorias";
import { INTERESES } from "../lib/intereses";
import { validarContrasena } from "../lib/password";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

export default function PerfilScreen() {
  const { user, profile, loading, signOut, refreshProfile } = useUser();
  const router = useRouter();

  const [editVisible, setEditVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [interesesSeleccionados, setInteresesSeleccionados] = useState<string[]>([]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message?: string; type: AppAlertType } | null>(null);

  function showAlert(title: string, message?: string, type: AppAlertType = "error") {
    setAlertInfo({ title, message, type });
  }

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user]);

  function openEdit() {
    setNombre(profile?.full_name ?? "");
    setBio(profile?.bio ?? "");
    setInteresesSeleccionados(profile?.interests ?? []);
    setEditVisible(true);
  }

  function toggleInteres(interes: string) {
    setInteresesSeleccionados((prev) =>
      prev.includes(interes) ? prev.filter((i) => i !== interes) : [...prev, interes]
    );
  }

  function showErrorMsg(msg: string) {
    showAlert("No se pudo completar", msg, "error");
  }

  async function cambiarContrasena() {
    if (!newPassword || !confirmNewPassword) {
      showAlert("Completa los campos", "Ingresa y confirma tu nueva contraseña.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showAlert("Contraseñas no coinciden", "Verifica que ambas contraseñas sean iguales.");
      return;
    }

    const errorContrasena = validarContrasena(newPassword);
    if (errorContrasena) {
      showAlert("Contraseña insegura", errorContrasena);
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      showAlert("No se pudo cambiar la contraseña", error.message);
      return;
    }

    setPasswordVisible(false);
    setNewPassword("");
    setConfirmNewPassword("");
    showAlert("Contraseña actualizada", "Tu contraseña se cambió correctamente.", "success");
  }

  async function guardarPerfil() {
    if (!user) return;

    setSavingProfile(true);
    // Conservamos la membresía a grupos (CATEGORIAS), que se maneja aparte
    // desde /grupo/[categoria], para no expulsar al usuario de sus grupos
    // solo por editar sus intereses personales aquí.
    const gruposActuales = (profile?.interests ?? []).filter((i) =>
      CATEGORIAS.some((c) => c.titulo === i)
    );
    const interests = Array.from(new Set([...interesesSeleccionados, ...gruposActuales]));

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: nombre.trim() || null,
        bio: bio.trim() || null,
        interests,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSavingProfile(false);

    if (error) {
      showErrorMsg(`No se pudo guardar: ${error.message}`);
      return;
    }

    await refreshProfile();
    setEditVisible(false);
  }

  async function cambiarFoto() {
    if (!user) return;

    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showErrorMsg("Necesitamos acceso a tus fotos para cambiar tu foto de perfil.");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (resultado.canceled || !resultado.assets?.length) {
      return;
    }

    setUploadingPhoto(true);
    try {
      const asset = resultado.assets[0];
      const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
      const contentType = asset.mimeType ?? `image/${ext === "jpg" ? "jpeg" : ext}`;
      const path = `${user.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await refreshProfile();
    } catch (e: any) {
      showErrorMsg(`No se pudo subir la foto: ${e.message ?? e}`);
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#324F40" />
      </View>
    );
  }

  const intereses = profile?.interests ?? [];
  const misGrupos = CATEGORIAS.filter((c) => intereses.includes(c.titulo));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)} hitSlop={10}>
          <Ionicons name="ellipsis-vertical" size={22} color="#334155" />
        </TouchableOpacity>

        <TouchableOpacity onPress={cambiarFoto} disabled={uploadingPhoto} style={styles.avatarWrap}>
          <Image
            source={{
              uri:
                profile?.avatar_url ||
                `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
                  profile?.full_name ?? user.email ?? "user"
                )}`,
            }}
            style={styles.avatar}
          />
          <View style={styles.avatarEditBadge}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile?.full_name ?? user.email?.split("@")[0]}</Text>
          <Text style={styles.emailText}>{user.email}</Text>
          <Text style={styles.bio}>
            {profile?.bio ?? "Actualiza tu biografía para que otros te conozcan mejor."}
          </Text>

          <TouchableOpacity style={styles.button} onPress={openEdit}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Mis grupos</Text>
        {misGrupos.length > 0 ? (
          <View style={styles.tagsRow}>
            {misGrupos.map((item) => (
              <TouchableOpacity
                key={item.titulo}
                style={[styles.tag, { backgroundColor: item.color }]}
                onPress={() => router.push(`/grupo/${encodeURIComponent(item.titulo)}`)}
              >
                <Ionicons name={item.icon as any} size={14} color="#fff" />
                <Text style={[styles.tagText, styles.tagTextLight]}>{item.titulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Aún no te has unido a ningún grupo. Explora Inicio para encontrar uno.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Mis intereses</Text>
        {intereses.length > 0 ? (
          <View style={styles.tagsRow}>
            {intereses.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Aún no agregas intereses. Toca "Editar perfil" para añadirlos.</Text>
        )}
      </View>

      <Modal visible={editVisible} animationType="fade" transparent onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditVisible(false)}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Editar perfil</Text>

            <TextInput
              placeholder="Nombre completo"
              value={nombre}
              onChangeText={setNombre}
              style={styles.modalInput}
            />

            <TextInput
              placeholder="Biografía"
              value={bio}
              onChangeText={setBio}
              multiline
              style={styles.modalDescription}
            />

            <Text style={styles.interesesLabel}>Intereses</Text>
            <View style={styles.interesesGrid}>
              {INTERESES.map((interes) => {
                const activo = interesesSeleccionados.includes(interes);
                return (
                  <TouchableOpacity
                    key={interes}
                    onPress={() => toggleInteres(interes)}
                    style={[styles.interesChip, activo && styles.interesChipActivo]}
                  >
                    <Text style={[styles.interesChipTexto, activo && styles.interesChipTextoActivo]}>
                      {interes}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.guardarBtn} onPress={guardarPerfil} disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="white" />
                    <Text style={styles.guardarTexto}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={menuVisible} animationType="fade" transparent onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuTitle}>Configuración</Text>

            <View style={styles.menuEmailRow}>
              <Ionicons name="mail-outline" size={18} color="#64748b" />
              <Text style={styles.menuEmailText}>{user.email}</Text>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                openEdit();
              }}
            >
              <Ionicons name="create-outline" size={20} color="#334155" />
              <Text style={styles.menuItemText}>Editar perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setNewPassword("");
                setConfirmNewPassword("");
                setPasswordVisible(true);
              }}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#334155" />
              <Text style={styles.menuItemText}>Cambiar contraseña</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => {
                setMenuVisible(false);
                signOut();
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF3340" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={passwordVisible} animationType="fade" transparent onRequestClose={() => setPasswordVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPasswordVisible(false)}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>

            <TextInput
              placeholder="Nueva contraseña"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={styles.modalInput}
            />

            <TextInput
              placeholder="Confirmar nueva contraseña"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              style={styles.modalInput}
            />

            <Text style={styles.passwordHint}>
              Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setPasswordVisible(false)}>
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.guardarBtn} onPress={cambiarContrasena} disabled={changingPassword}>
                {changingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="white" />
                    <Text style={styles.guardarTexto}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AppAlert
        visible={alertInfo !== null}
        type={alertInfo?.type}
        title={alertInfo?.title ?? ""}
        message={alertInfo?.message}
        onClose={() => setAlertInfo(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  menuButton: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 1,
    padding: 6,
  },
  emailText: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 2,
  },
  avatarWrap: {
    alignSelf: "center",
    marginBottom: 12,
    position: "relative",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#324F40",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerInfo: {
    alignItems: "center",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  role: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 14,
  },
  bio: {
    color: "#475569",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 14,
    backgroundColor: "#324F40",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#111827",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCE7E1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  tagTextLight: {
    color: "#fff",
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  activityText: {
    marginLeft: 8,
    color: "#334155",
  },
  buttonSecondary: {
    backgroundColor: "#94a3b8",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    color: "#334155",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalDescription: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  interesesLabel: {
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  interesesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  interesChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
  },
  interesChipActivo: {
    backgroundColor: "#324F40",
    borderColor: "#324F40",
  },
  interesChipTexto: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 13,
  },
  interesChipTextoActivo: {
    color: "#fff",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  cancelarBtn: {
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelarTexto: {
    fontWeight: "600",
    color: "#475569",
  },
  guardarBtn: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "#324F40",
    borderRadius: 10,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  guardarTexto: {
    color: "white",
    fontWeight: "700",
    marginLeft: 5,
  },
  passwordHint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
  },
  menuContainer: {
    width: "85%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuEmailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuEmailText: {
    marginLeft: 8,
    color: "#64748b",
    fontSize: 13,
    flexShrink: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 10,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  menuItemDanger: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  menuItemTextDanger: {
    color: "#EF3340",
  },
});
