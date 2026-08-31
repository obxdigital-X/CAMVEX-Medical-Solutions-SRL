export type ContentField = {
  key: string
  label: string
  group: string
  type: "text" | "textarea"
  default: string
  hint?: string
}

// Single source of truth for editable site texts + their defaults.
// The public site falls back to `default` when a key is not stored in the DB.
export const CONTENT_FIELDS: ContentField[] = [
  // Hero
  {
    key: "hero_eyebrow",
    label: "Etiqueta superior (hero)",
    group: "Portada (Hero)",
    type: "text",
    default: "Santo Domingo · República Dominicana",
  },
  {
    key: "hero_title",
    label: "Título principal",
    group: "Portada (Hero)",
    type: "textarea",
    default: "Equipos médicos y de laboratorio, con *respuesta real* cuando los necesitas.",
    hint: "El texto entre *asteriscos* se resalta con color.",
  },
  {
    key: "hero_lead",
    label: "Párrafo de introducción",
    group: "Portada (Hero)",
    type: "textarea",
    default:
      "Comercializamos y distribuimos equipos, dispositivos, insumos y servicio de esterilización para clínicas, laboratorios de patología y centros médicos. No mostramos un catálogo interminable: identificamos la necesidad y encontramos la alternativa correcta.",
  },
  // Nosotros
  {
    key: "about_heading",
    label: "Título de la sección",
    group: "Quiénes somos",
    type: "textarea",
    default: "Un socio estratégico para el sector salud, no solo un proveedor.",
  },
  {
    key: "about_text",
    label: "Descripción",
    group: "Quiénes somos",
    type: "textarea",
    default:
      "CAMVEX Medical Solutions es una empresa dominicana enfocada en la comercialización y distribución de equipos médicos, dispositivos, materiales desechables e insumos especializados para instituciones y profesionales de la salud.",
  },
  {
    key: "mission_text",
    label: "Misión",
    group: "Quiénes somos",
    type: "textarea",
    default:
      "Distribuir equipos, dispositivos y suministros médicos confiables a clínicas, laboratorios y centros de salud en República Dominicana, garantizando disponibilidad, respaldo técnico y continuidad en cada suministro.",
  },
  {
    key: "vision_text",
    label: "Visión",
    group: "Quiénes somos",
    type: "textarea",
    default:
      "Ser una empresa reconocida en República Dominicana por representar una nueva generación en la distribución de soluciones médicas, incorporando innovación, tecnología y productos de vanguardia al mercado nacional.",
  },
  // Contacto
  {
    key: "contact_intro",
    label: "Texto de introducción",
    group: "Contacto",
    type: "textarea",
    default: "Escríbenos por el canal que prefieras, respondemos en 24 a 48 horas hábiles.",
  },
  {
    key: "contact_whatsapp",
    label: "WhatsApp / Ventas",
    group: "Contacto",
    type: "text",
    default: "829-862-2291",
  },
  {
    key: "contact_phone",
    label: "Línea directa",
    group: "Contacto",
    type: "text",
    default: "849-869-2292",
  },
  {
    key: "contact_email",
    label: "Correo comercial",
    group: "Contacto",
    type: "text",
    default: "ventas@camvexrd.com",
  },
]

export type ContentMap = Record<string, string>

// Merge stored values over defaults so the site always has a complete set.
export function withDefaults(stored: ContentMap): ContentMap {
  const map: ContentMap = {}
  for (const f of CONTENT_FIELDS) {
    const v = stored[f.key]
    map[f.key] = v != null && v !== "" ? v : f.default
  }
  return map
}
