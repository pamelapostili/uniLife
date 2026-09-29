import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

/**
 * Envuelve el contenido de una pantalla para que en pantallas anchas
 * (tablet/web) no se estire de borde a borde: se centra con un ancho máximo
 * y conserva el 100% del ancho en teléfonos, donde no tiene ningún efecto.
 */
export default function ScreenContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.inner, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  inner: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
});
