// Ajustes compartidos de Recharts: los colores salen de las variables CSS para seguir al tema y a la línea
// del Metrô de la sección abierta (estilos.css, :root[data-linea]).

export const ESTILO_TOOLTIP = {
  contentStyle: {
    background: "var(--superficie)",
    border: "1px solid var(--borde)",
    borderRadius: 10,
    boxShadow: "var(--sombra-flotante)",
  },
  itemStyle: { color: "var(--texto)" },
  labelStyle: { color: "var(--texto-2)" },
};

export const EJE = { stroke: "var(--texto-tenue)", fontSize: 12 };

/** Color de la serie principal: el de la línea de la sección, ajustado para leerse sobre el fondo. */
export const SERIE_1 = "var(--serie-seccion)";

/** Texto sobre una barra de SERIE_1. */
export const SOBRE_SERIE = "var(--sobre-serie)";

/** Animación de entrada de las series: corta y con desaceleración. */
export const ANIMACION = { animationDuration: 900, animationEasing: "ease-out" } as const;
