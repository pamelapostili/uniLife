import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";
import { useUser } from "../../lib/user-context";


export default function Usuarios() {

  const { tipo } = useLocalSearchParams();

  const { user } = useUser();

  const router = useRouter();

  const [usuarios,setUsuarios] = useState<any[]>([]);



  useEffect(()=>{

    cargarUsuarios();

  },[]);



  const cargarUsuarios = async()=>{

    const {data,error}=await supabase
    .from("profiles")
    .select(
      "id,full_name,avatar_url,bio,interests"
    )
    .neq("id",user?.id);



    if(!error){
      setUsuarios(data ?? []);
    }

  };



  const eliminarSugerencia=(id:string)=>{

    setUsuarios(
      prev =>
      prev.filter(
        usuario=>usuario.id!==id
      )
    );

  };



return (

<View style={styles.container}>


{/* ENCABEZADO */}

<View style={styles.header}>


<TouchableOpacity
onPress={()=>router.back()}
>

<Ionicons
name="arrow-back"
size={25}
/>

</TouchableOpacity>



<View>

<Text style={styles.headerTitle}>
Usuarios
</Text>


<Text style={styles.headerSubtitle}>
Personas para {tipo}
</Text>


</View>


</View>





<FlatList

data={usuarios}

keyExtractor={(item)=>item.id}


renderItem={({item})=>(


<View style={styles.card}>


<Image

source={{
uri:
item.avatar_url ??
"https://i.pravatar.cc/150"
}}

style={styles.avatar}

/>


<View style={styles.info}>


<Text style={styles.name}>
{item.full_name ?? "Usuario"}
</Text>



<Text style={styles.bio}>
{item.bio ?? "Nuevo miembro"}
</Text>





{/* ETIQUETAS */}

<View style={styles.tags}>


{item.interests?.slice(0,3)
.map((tag:string)=>(


<View
key={tag}
style={styles.tag}
>

<Text style={styles.tagText}>
{tag}
</Text>


</View>


))}


</View>





<View style={styles.buttons}>


<TouchableOpacity

style={styles.message}

onPress={()=>
router.push(`/chat/${item.id}`)
}

>

<Ionicons
name="chatbubble-outline"
size={18}
color="white"
/>


<Text style={styles.buttonText}>
Mensaje
</Text>


</TouchableOpacity>





<TouchableOpacity

style={styles.delete}

onPress={()=>
eliminarSugerencia(item.id)
}

>

<Ionicons
name="close-circle-outline"
size={18}
/>


<Text>
Eliminar
</Text>


</TouchableOpacity>



</View>



</View>


</View>


)}


/>


</View>

);

}



const styles=StyleSheet.create({

container:{
flex:1,
backgroundColor:"#F7F8FA",
paddingHorizontal:15
},


header:{
height:80,
flexDirection:"row",
alignItems:"center",
gap:15,
marginTop:20
},


headerTitle:{
fontSize:22,
fontWeight:"700",
color:"#334155"
},


headerSubtitle:{
color:"#64748b",
marginTop:4
},


card:{
backgroundColor:"white",
borderRadius:18,
padding:15,
flexDirection:"row",
marginBottom:15
},


avatar:{
width:75,
height:75,
borderRadius:40,
marginRight:15
},


info:{
flex:1
},


name:{
fontSize:18,
fontWeight:"700"
},


bio:{
color:"#64748b",
marginTop:5
},


tags:{
flexDirection:"row",
flexWrap:"wrap",
marginTop:10
},


tag:{
backgroundColor:"#e3edca",
paddingHorizontal:10,
paddingVertical:5,
borderRadius:20,
marginRight:7,
marginBottom:5
},


tagText:{
color:"#6f7e49",
fontWeight:"600",
fontSize:12
},



buttons:{
flexDirection:"row",
marginTop:12,
gap:10
},


message:{
backgroundColor:"#6f7e49",
paddingHorizontal:12,
paddingVertical:8,
borderRadius:10,
flexDirection:"row",
alignItems:"center",
gap:5
},


delete:{
backgroundColor:"#E5E7EB",
paddingHorizontal:12,
paddingVertical:8,
borderRadius:10,
flexDirection:"row",
alignItems:"center",
gap:5
},


buttonText:{
color:"white",
fontWeight:"600"
}


});