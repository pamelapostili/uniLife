import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import { fetchRequestInfoBulk, RequestInfo, sendMessageRequest } from "../lib/messageRequests";
import { INTERESES } from "../lib/intereses";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

const categorias = [
  "Todos",
  "Eventos",
  "Reuniones",
  "Club",
  "Preguntas",
  "Amor",
  "Ayuda",
];

export default function ForosScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [fetching, setFetching] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [interesesFiltro, setInteresesFiltro] = useState<string[]>([]);
  const [authorInterests, setAuthorInterests] = useState<Record<string, string[]>>({});
  const [requestInfoMap, setRequestInfoMap] = useState<Record<string, RequestInfo>>({});
  const [mensajeBusy, setMensajeBusy] = useState<string | null>(null);

const [foros, setForos] = useState<any[]>([]);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState("Eventos");
  const [modalVisible, setModalVisible] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [foroEditando, setForoEditando] = useState<any>(null);

  const [modalRespuestas, setModalRespuestas] = useState(false);
const [foroSeleccionado, setForoSeleccionado] = useState<any>(null);
const [respuestas, setRespuestas] = useState<any[]>([]);
const [nuevaRespuesta, setNuevaRespuesta] = useState("");

useEffect(() => {
  console.log("USER:", user);
  console.log("LOADING:", loading);

if (!loading && !user) {
  setFetching(false);
  router.replace("/login");
  return;
}

  if (user) {
    console.log("Cargando foros...");
    cargarForos();
  }
}, [loading, user]);

// Tiempo real: cualquier publicación nueva, editada, borrada, con like o
// respuesta nueva (que suma al contador) se refleja para todos sin recargar.
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel("foros-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "foros" }, () => cargarForos())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);


  const cargarForos = async () => {
  setFetching(true);

  const { data, error } = await supabase
    .from("foros")
    .select("*")
    .order("creado", { ascending: false });

  console.log("DATA:", data);
  console.log("ERROR:", error);

  if (error) {
    alert(error.message);
    setFetching(false);
    return;
  }

  setForos(data ?? []);
  setFetching(false);

  const authorIds = Array.from(
    new Set((data ?? []).map((f: any) => f.user_id).filter((id: any) => !!id))
  ) as string[];

  if (user && authorIds.length > 0) {
    const [{ data: perfiles }, reqMap] = await Promise.all([
      supabase.from("profiles").select("id, interests").in("id", authorIds),
      fetchRequestInfoBulk(user.id, authorIds),
    ]);

    const interestsMap: Record<string, string[]> = {};
    (perfiles ?? []).forEach((p: any) => {
      interestsMap[p.id] = p.interests ?? [];
    });
    setAuthorInterests(interestsMap);
    setRequestInfoMap(reqMap);
  } else {
    setAuthorInterests({});
    setRequestInfoMap({});
  }
};

// Mientras el modal de respuestas está abierto, las respuestas nuevas de
// otros usuarios aparecen solas (sin tener que cerrar y volver a abrir).
useEffect(() => {
  if (!modalRespuestas || !foroSeleccionado) return;

  const channel = supabase
    .channel(`respuestas-${foroSeleccionado.id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "respuestas", filter: `foro_id=eq.${foroSeleccionado.id}` },
      (payload) => {
        setRespuestas((prev) => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [modalRespuestas, foroSeleccionado]);

function toggleInteresFiltro(interes: string) {
  setInteresesFiltro((prev) =>
    prev.includes(interes) ? prev.filter((i) => i !== interes) : [...prev, interes]
  );
}

async function handleMensajeAutor(authorId: string) {
  if (!user) return;
  const info = requestInfoMap[authorId] ?? {};

  const accepted = info.mine?.status === "accepted" || info.theirs?.status === "accepted";
  if (accepted) {
    const chatId = info.mine?.chat_id ?? info.theirs?.chat_id;
    if (chatId) router.push(`/chat/${chatId}`);
    return;
  }

  if (info.theirs?.status === "pending") {
    router.push("/notificaciones");
    return;
  }

  if (info.mine?.status === "pending") {
    return;
  }

  setMensajeBusy(authorId);
  const { error } = await sendMessageRequest(user.id, authorId);
  if (!error) {
    setRequestInfoMap((prev) => ({
      ...prev,
      [authorId]: { ...prev[authorId], mine: { status: "pending", chat_id: null } },
    }));
  }
  setMensajeBusy(null);
}

function mensajeAutorLabel(authorId: string) {
  const info = requestInfoMap[authorId] ?? {};
  if (info.mine?.status === "accepted" || info.theirs?.status === "accepted") return "Chatear";
  if (info.theirs?.status === "pending") return "Responder";
  if (info.mine?.status === "pending") return "Enviado";
  return "Mensaje";
}

const editarForo = (foro: any) => {
  setModoEdicion(true);
  setForoEditando(foro);

  setTitulo(foro.titulo);
  setDescripcion(foro.descripcion);
  setCategoriaNueva(foro.categoria);

  setModalVisible(true);
};

const eliminarForo = async (id: number) => {
  const { error } = await supabase
    .from("foros")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Foro eliminado");
  cargarForos();
};

const verRespuestas = async (foro:any)=>{

  setForoSeleccionado(foro);

  const {data,error}=await supabase
    .from("respuestas")
    .select("*")
    .eq("foro_id",foro.id)
    .order("creado",{ascending:false});


  if(error){
    alert(error.message);
    return;
  }


  setRespuestas(data ?? []);
  setModalRespuestas(true);
};

const agregarRespuesta = async () => {

  if (!nuevaRespuesta.trim()) {
    return;
  }

  if (!user) {
    alert("Inicia sesión");
    return;
  }


  // guardar respuesta
  const { error } = await supabase
    .from("respuestas")
    .insert({
      foro_id: foroSeleccionado.id,
      user_id: user.id,
      autor: user.email,
      mensaje: nuevaRespuesta.trim()
    });


  if(error){
    alert(error.message);
    return;
  }


  // aumentar contador del foro
  await supabase
    .from("foros")
    .update({
      respuestas: (foroSeleccionado.respuestas ?? 0) + 1
    })
    .eq("id", foroSeleccionado.id);


  setNuevaRespuesta("");

  verRespuestas(foroSeleccionado);

};

const darLike = async (foro: any) => {

  if (!user) return;

  const { error } = await supabase
    .from("likes_foros")
    .insert({
      foro_id: foro.id,
      user_id: user.id,
    });

  if (error) {

    if (error.code === "23505") {
      alert("Ya diste like");
      return;
    }

    alert(error.message);
    return;
  }

  await supabase
    .from("foros")
    .update({
      likes: (foro.likes ?? 0) + 1
    })
    .eq("id", foro.id);

  cargarForos();
};


const actualizarForo = async () => {
  if (!foroEditando) return;

  console.log("ID:", foroEditando.id);

  const { data, error, status } = await supabase
    .from("foros")
    .update({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoria: categoriaNueva,
    })
    .eq("id", foroEditando.id)
    .select();

  console.log("STATUS:", status);
  console.log("DATA:", data);
  console.log("ERROR:", error);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Actualizado");
  cerrarModal();
  cargarForos();
};

const cerrarModal = () => {
  setModalVisible(false);

  setModoEdicion(false);
  setForoEditando(null);

  setTitulo("");
  setDescripcion("");
  setCategoriaNueva("Eventos");
};

const crearForo = async () => {

  if (!titulo.trim() || !descripcion.trim()) {
    alert("Completa todos los campos");
    return;
  }

  if (!user) {
    alert("Debes iniciar sesión");
    return;
  }

  const nuevoForo = {
    autor: user.email,
    user_id: user.id,
    titulo: titulo.trim(),
    descripcion: descripcion.trim(),
    categoria: categoriaNueva,
    likes: 0,
    respuestas: 0,
  };


  console.log("Insertando:", nuevoForo);


  const { data, error } = await supabase
    .from("foros")
    .insert(nuevoForo)
    .select();


  console.log("Respuesta Supabase:", data);
  console.log("Error Supabase:", error);


  if (error) {
    alert(error.message);
    return;
  }

  alert("Foro creado correctamente");

  cerrarModal();


  cargarForos();
};

  const filtrados = foros.filter((foro) => {
    const coincideTexto =
      foro.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      foro.descripcion.toLowerCase().includes(busqueda.toLowerCase());

    const coincideCategoria =
      categoria === "Todos" || foro.categoria === categoria;

    const interesesAutor = foro.user_id ? authorInterests[foro.user_id] ?? [] : [];
    const coincideIntereses =
      interesesFiltro.length === 0 || interesesAutor.some((i) => interesesFiltro.includes(i));

    return coincideTexto && coincideCategoria && coincideIntereses;
  });

  const renderPost = ({ item }: any) => (
    <View style={styles.postCard}>
      <View style={styles.headerPost}>
        <TouchableOpacity
          style={styles.userInfo}
          disabled={!item.user_id}
          onPress={() => item.user_id && router.push(`/usuario/${item.user_id}`)}
        >
<Image
  source={{
    uri:
      item.avatar ??
      "https://i.pravatar.cc/150",
  }}
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
                {new Date(item.creado).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {item.user_id && item.user_id === user?.id && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => editarForo(item)}>
                <Ionicons
                name="create-outline"
                size={20}
                color="#64748b"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => eliminarForo(item.id)}>
              <Ionicons
                name="trash-outline"
                size={20}
                color="#EF3340"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.descripcion}>
        {item.descripcion}
      </Text>

      <View style={styles.footer}>
<TouchableOpacity
  style={styles.footerItem}
  onPress={() => verRespuestas(item)}
>

  <Ionicons
    name="chatbubble-outline"
    size={18}
    color="#64748b"
  />

  <Text style={styles.footerText}>
    {item.respuestas} respuestas
  </Text>

</TouchableOpacity>

        <TouchableOpacity
          style={styles.footerItem}
          onPress={() => darLike(item)}
        >
          <Ionicons
            name="thumbs-up-outline"
            size={18}
            color="#64748b"
          />
          <Text style={styles.footerText}>
            {item.likes}
          </Text>
        </TouchableOpacity>

        {item.user_id && item.user_id !== user?.id && (
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => handleMensajeAutor(item.user_id)}
            disabled={mensajeBusy === item.user_id}
          >
            {mensajeBusy === item.user_id ? (
              <ActivityIndicator size="small" color="#64748b" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#64748b" />
                <Text style={styles.footerText}>{mensajeAutorLabel(item.user_id)}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>
          Foros de la Comunidad
        </Text>

        <TouchableOpacity style={styles.botonCrear} onPress={() => setModalVisible(true)}>
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

      <Text style={styles.filtroInteresesLabel}>Filtrar por intereses del autor</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.interesesFiltroRow}>
        {INTERESES.map((interes) => {
          const activo = interesesFiltro.includes(interes);
          return (
            <TouchableOpacity
              key={interes}
              onPress={() => toggleInteresFiltro(interes)}
              style={[styles.categoriaBtn, activo && styles.categoriaActiva]}
            >
              <Text style={[styles.categoriaTexto, activo && styles.categoriaTextoActiva]}>
                {interes}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

{fetching ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#324F40" />
  </View>
) : (
  <>
    <FlatList
      data={filtrados}
      keyExtractor={(item) => item.id}
      renderItem={renderPost}
      showsVerticalScrollIndicator={false}
    />

   <Modal
      visible={modalVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setModalVisible(false)}
    >
  <Pressable
    style={styles.modalOverlay}
    onPress={() => setModalVisible(false)}
  >
    <Pressable
      style={styles.modalContainer}
      onPress={(e) => e.stopPropagation()}
    >
      <Text style={styles.modalTitle}>
        {modoEdicion ? "Editar Foro" : "Crear Foro"}
      </Text>

      <TextInput
        placeholder="Título"
        value={titulo}
        onChangeText={setTitulo}
        style={styles.modalInput}
      />

      <TextInput
        placeholder="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        style={styles.modalDescription}
      />

      <Text style={styles.categoriaTitulo}>
        Categoría
      </Text>

      <View style={styles.categoriaSelector}>
        {categorias
          .filter((cat) => cat !== "Todos")
          .map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategoriaNueva(cat)}
              style={[
                styles.categoriaModal,
                categoriaNueva === cat &&
                  styles.categoriaModalActiva,
              ]}
            >
              <Text
                style={[
                  styles.categoriaModalTexto,
                  categoriaNueva === cat &&
                    styles.categoriaModalTextoActivo,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={styles.cancelarBtn}
          onPress={() => setModalVisible(false)}
        >
          <Text style={styles.cancelarTexto}>
            Cancelar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guardarBtn}
          onPress={modoEdicion ? actualizarForo : crearForo}        
          >
          <Ionicons
            name="checkmark"
            size={18}
            color="white"
          />
<Text style={styles.guardarTexto}>
  {modoEdicion ? "Actualizar" : "Guardar"}
</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  </Pressable>
</Modal>

<Modal
  visible={modalRespuestas}
  animationType="slide"
  transparent
  onRequestClose={() => setModalRespuestas(false)}
>
  <View style={styles.modalOverlay}>

    <View style={styles.modalContainer}>

      <Text style={styles.modalTitle}>
        Respuestas
      </Text>


      <FlatList
        data={respuestas}
        keyExtractor={(item)=>item.id.toString()}
        style={{maxHeight:250}}
        renderItem={({item})=>(
          <View
            style={{
              backgroundColor:"#F1F5F9",
              padding:10,
              borderRadius:10,
              marginBottom:10
            }}
          >

            <Text
              style={{
                fontWeight:"700",
                color:"#334155"
              }}
            >
              {item.autor}
            </Text>


            <Text>
              {item.mensaje}
            </Text>


            <Text
              style={{
                fontSize:12,
                color:"#64748b"
              }}
            >
              {new Date(item.creado)
              .toLocaleDateString()}
            </Text>


          </View>
        )}
      />


      <TextInput
        placeholder="Escribe una respuesta..."
        value={nuevaRespuesta}
        onChangeText={setNuevaRespuesta}
        multiline
        style={styles.modalDescription}
      />


      <View style={styles.modalButtons}>


        <TouchableOpacity
          style={styles.cancelarBtn}
          onPress={()=>setModalRespuestas(false)}
        >

          <Text style={styles.cancelarTexto}>
            Cerrar
          </Text>

        </TouchableOpacity>



        <TouchableOpacity
          style={styles.guardarBtn}
          onPress={agregarRespuesta}
        >

          <Ionicons
            name="send"
            size={18}
            color="white"
          />

          <Text style={styles.guardarTexto}>
            Responder
          </Text>

        </TouchableOpacity>


      </View>


    </View>

  </View>

</Modal>
  </>
)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F0",
    padding: 15,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
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
    backgroundColor: "#324F40",
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

  filtroInteresesLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },

  interesesFiltroRow: {
    marginBottom: 15,
  },

  modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "center",
  alignItems: "center",
},

modalContainer: {
  width: "82%",
  backgroundColor: "#fff",
  borderRadius: 18,
  padding: 20,
},

modalTitle: {
  fontSize: 22,
  fontWeight: "700",
  textAlign: "center",
  marginBottom: 20,
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
  height: 90,
  textAlignVertical: "top",
},

categoriaTitulo: {
  marginTop: 15,
  marginBottom: 10,
  fontWeight: "600",
  color: "#475569",
},

categoriaSelector: {
  flexDirection: "row",
  flexWrap: "wrap",
  marginBottom: 20,
},

categoriaModal: {
  borderWidth: 1,
  borderColor: "#d1d5db",
  borderRadius: 20,
  paddingHorizontal: 14,
  paddingVertical: 8,
  marginRight: 8,
  marginBottom: 8,
  backgroundColor: "#F8FAFC",
},

categoriaModalActiva: {
  backgroundColor: "#324F40",
  borderColor: "#324F40",
},

categoriaModalTexto: {
  color: "#64748b",
  fontWeight: "600",
},

categoriaModalTextoActivo: {
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

  categoriaActiva: {
    backgroundColor: "#324F40",
    borderColor: "#324F40",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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