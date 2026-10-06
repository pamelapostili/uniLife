const PASSWORDS_COMUNES = [
  "password",
  "12345678",
  "123456789",
  "qwerty123",
  "contrasena",
  "contraseña",
  "11111111",
  "00000000",
  "abcdefgh",
  "iloveyou",
  "admin123",
  "qwertyui",
  "unilife1",
];

function tieneSecuencia(value: string) {
  const lower = value.toLowerCase();
  for (let i = 0; i <= lower.length - 4; i++) {
    const slice = lower.slice(i, i + 4);
    let ascendente = true;
    let descendente = true;
    for (let j = 1; j < slice.length; j++) {
      const diff = slice.charCodeAt(j) - slice.charCodeAt(j - 1);
      if (diff !== 1) ascendente = false;
      if (diff !== -1) descendente = false;
    }
    if (ascendente || descendente) return true;
  }
  return false;
}

export function validarContrasena(value: string): string | null {
  if (value.length < 8) return "Debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "Debe incluir al menos una letra mayúscula.";
  if (!/[a-z]/.test(value)) return "Debe incluir al menos una letra minúscula.";
  if (!/[0-9]/.test(value)) return "Debe incluir al menos un número.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Debe incluir al menos un símbolo (por ejemplo: !@#$%).";
  if (/(.)\1{3,}/.test(value)) return "No repitas el mismo carácter varias veces seguidas.";
  if (tieneSecuencia(value)) return "No uses secuencias fáciles de adivinar (como 1234 o abcd).";
  if (PASSWORDS_COMUNES.includes(value.toLowerCase())) return "Esa contraseña es demasiado común, elige otra.";
  return null;
}
