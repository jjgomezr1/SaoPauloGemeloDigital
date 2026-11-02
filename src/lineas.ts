import { createContext, useContext } from "react";

// Cada sección viaja en una línea del Metrô de São Paulo: su color tiñe la cabecera, los gráficos, el mapa
// y la navegación. Se mantiene la regla del sistema visual: color con significado (P1 azul, P2 amarillo).
// Las variables CSS de cada línea están en estilos.css, bajo :root[data-linea="…"].

export type Rampa = "azul" | "amarillo" | "rojo" | "verde" | "lila" | "plata";

export interface Linea {
  /** Número de la línea, como en el círculo de las placas. */
  numero: string;
  /** Nombre oficial de la línea. */
  nombre: string;
  /** Color oficial (para círculos y franjas). */
  color: string;
  /** Color del texto sobre `color`. */
  sobre: string;
  rampa: Rampa;
}

export const LINEAS: Record<string, Linea> = {
  azul: { numero: "1", nombre: "Azul", color: "#0455a1", sobre: "#ffffff", rampa: "azul" },
  verde: { numero: "2", nombre: "Verde", color: "#007e5e", sobre: "#ffffff", rampa: "verde" },
  roja: { numero: "3", nombre: "Vermelha", color: "#ee372f", sobre: "#ffffff", rampa: "rojo" },
  amarilla: { numero: "4", nombre: "Amarela", color: "#fed304", sobre: "#1f2428", rampa: "amarillo" },
  lila: { numero: "5", nombre: "Lilás", color: "#9b3894", sobre: "#ffffff", rampa: "lila" },
  plata: { numero: "15", nombre: "Prata", color: "#9ea0a4", sobre: "#1f2428", rampa: "plata" },
};

/** La línea de cada sección. Las que no aparecen usan la azul (la del acento general). */
export const LINEA_DE_SECCION: Record<string, keyof typeof LINEAS> = {
  panorama: "azul",
  mapa: "azul",
  transporte: "azul",
  empleo: "amarilla",
  gente: "roja",
  ambiente: "verde",
  municipio: "lila",
  fuentes: "plata",
  "no-cubrimos": "plata",
};

export function lineaDe(seccion: string): Linea {
  return LINEAS[LINEA_DE_SECCION[seccion] ?? "azul"];
}

/** La línea de la sección abierta, para los componentes que pintan con su color (mapa, gráficos). */
export const LineaContexto = createContext<Linea>(LINEAS.azul);

export const useLinea = () => useContext(LineaContexto);
