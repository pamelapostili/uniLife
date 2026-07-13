export type Categoria = {
  titulo: string;
  color: string;
  icon: string;
};

export const CATEGORIAS: Categoria[] = [
  {
    titulo: "Citas",
    color: "#ff3b8d",
    icon: "heart-outline",
  },
  {
    titulo: "Socializar",
    color: "#10b981",
    icon: "people-outline",
  },
  {
    titulo: "Hacer amigos",
    color: "#3b82f6",
    icon: "person-add-outline",
  },
  {
    titulo: "Club de lectura",
    color: "#a855f7",
    icon: "book-outline",
  },
  {
    titulo: "Club de deporte",
    color: "#f97316",
    icon: "fitness-outline",
  },
  {
    titulo: "Reto deportivo",
    color: "#eab308",
    icon: "trophy-outline",
  },
];
