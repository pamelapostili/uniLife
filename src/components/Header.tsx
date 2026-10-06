import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../lib/user-context";

type HeaderProps = {
  title?: string;
  back?: boolean;
};

/**
 * Encabezado usado en toda la app (registrado como header global de los Tabs
 * en _layout.tsx). Se adapta al notch/status bar con safe-area insets y al
 * ancho de pantalla para verse bien tanto en teléfono como en tablet/web.
 */
export default function Header({ title, back }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useUser();
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.left}>
          {back ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color="#1f2937" />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoWrap}>
              <Ionicons name="school" size={20} color="#324F40" />
            </View>
          )}
          <Text style={styles.brand} numberOfLines={1}>
            {title ?? "UniLife"}
          </Text>
        </View>

        {user && (
          <TouchableOpacity onPress={() => router.push("/perfil")} style={styles.avatarWrap}>
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
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderBottomWidth: 3,
    borderBottomColor: "#EF3340",
    ...Platform.select({
      web: { position: "sticky" as any, top: 0, zIndex: 10 },
    }),
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  contentWide: {
    paddingHorizontal: 24,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  backButton: {
    marginRight: 10,
  },
  logoWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#DCE7E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    flexShrink: 1,
  },
  avatarWrap: {
    marginLeft: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
});
