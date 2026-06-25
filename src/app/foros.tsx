import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const categorias = [
  "Todos",
  "Eventos",
  "Reuniones",
  "Ayuda",
];

const postsIniciales = [
  {
    id: "1",
    autor: "Carlosss",
    categoria: "Eventos",
    tiempo: "Hace 2 horas",
    titulo: "Torneo de Fútbol Universitario - Inscripciones Abiertas",
    descripcion:
      "Se abrieron las inscripciones para el torneo de fútbol. ¡No se lo pierdan!",
    respuestas: 24,
    likes: 56,
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "2",
    autor: "Ana",
    categoria: "Reuniones",
    tiempo: "Hace 5 horas",
    titulo: "Nuevo Club de Lectura de Ciencia Ficción",
    descripcion:
      "Estamos formando un club de lectura enfocado en ciencia ficción.",
    respuestas: 18,
    likes: 42,
    avatar: "https://i.pravatar.cc/150?img=32",
  },
  {
    id: "3",
    autor: "Luis",
    categoria: "Ayuda",
    tiempo: "Hace 1 día",
    titulo: "¿Alguien para estudiar cálculo?",
    descripcion:
      "Busco compañeros para formar un grupo de estudio de Cálculo II.",
    respuestas: 31,
    likes: 28,
    avatar: "https://i.pravatar.cc/150?img=15",
  },
];

export default function ForosScreen() {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todos");

  const filtrados = postsIniciales.filter((post) => {
    const coincideTexto =
      post.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      post.descripcion.toLowerCase().includes(busqueda.toLowerCase());

    const coincideCategoria =
      categoria === "Todos" || post.categoria === categoria;

    return coincideTexto && coincideCategoria;
  });

  const renderPost = ({ item }: any) => (
    <View style={styles.postCard}>
      <View style={styles.headerPost}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: item.avatar }}
            style={styles.avatar}
          />

          <View>
            <Text style={styles.tituloPost}>
              {item.titulo}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.autor}>
                {item.autor}
              </Text>

              <Text style={styles.dot}>•</Text>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.categoria}
                </Text>
              </View>

              <Text style={styles.dot}>•</Text>

              <Text style={styles.tiempo}>
                {item.tiempo}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity>
            <Ionicons
              name="create-outline"
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          <TouchableOpacity>
            <Ionicons
              name="trash-outline"
              size={20}
              color="#ef4444"
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.descripcion}>
        {item.descripcion}
      </Text>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color="#64748b"
          />
          <Text style={styles.footerText}>
            {item.respuestas} respuestas
          </Text>
        </View>

        <View style={styles.footerItem}>
          <Ionicons
            name="thumbs-up-outline"
            size={18}
            color="#64748b"
          />
          <Text style={styles.footerText}>
            {item.likes}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>
          Foros de la Comunidad
        </Text>

        <TouchableOpacity style={styles.botonCrear}>
          <Ionicons
            name="add"
            size={20}
            color="white"
          />
          <Text style={styles.textoCrear}>
            Crear Foro
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={20}
          color="#94a3b8"
        />

        <TextInput
          placeholder="Buscar en Foros..."
          value={busqueda}
          onChangeText={setBusqueda}
          style={styles.input}
        />
      </View>

      <View style={styles.categorias}>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setCategoria(cat)}
            style={[
              styles.categoriaBtn,
              categoria === cat &&
                styles.categoriaActiva,
            ]}
          >
            <Text
              style={[
                styles.categoriaTexto,
                categoria === cat &&
                  styles.categoriaTextoActiva,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    padding: 15,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 15,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
  },

  botonCrear: {
    backgroundColor: "#b9d27b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },

  textoCrear: {
    color: "white",
    fontWeight: "600",
    marginLeft: 5,
  },

  searchContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  input: {
    flex: 1,
    height: 50,
    marginLeft: 10,
  },

  categorias: {
    flexDirection: "row",
    marginBottom: 15,
  },

  categoriaBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: "white",
  },

  categoriaActiva: {
    backgroundColor: "#b9d27b",
    borderColor: "#b9d27b",
  },

  categoriaTexto: {
    fontWeight: "600",
  },

  categoriaTextoActiva: {
    color: "white",
  },

  postCard: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  headerPost: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  userInfo: {
    flexDirection: "row",
    flex: 1,
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 25,
    marginRight: 12,
  },

  tituloPost: {
    fontWeight: "700",
    fontSize: 16,
    flexWrap: "wrap",
    maxWidth: 240,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    flexWrap: "wrap",
  },

  autor: {
    color: "#64748b",
  },

  tiempo: {
    color: "#64748b",
  },

  dot: {
    marginHorizontal: 5,
    color: "#64748b",
  },

  badge: {
    backgroundColor: "#e3edca",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  badgeText: {
    color: "#7f7f7f",
    fontSize: 12,
    fontWeight: "600",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  descripcion: {
    marginTop: 12,
    color: "#334155",
  },

  footer: {
    flexDirection: "row",
    marginTop: 15,
  },

  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },

  footerText: {
    marginLeft: 5,
    color: "#64748b",
  },
});