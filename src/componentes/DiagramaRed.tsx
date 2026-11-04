import { LINEAS, type Linea } from "../lineas";
import { SECCIONES } from "../rutas";

// Diagrama de red de la portada: el sitio dibujado como el Metrô. Panorama es la estación Sé, donde se cruzan
// todas las líneas, y cada sección es la terminal de un ramal del color de su línea. Coordenadas en un
// lienzo de 1000 × 440; los ramales salen a 0°, 45° y 90° y luego siguen en horizontal, como en el mapa oficial.

interface Ramal {
  seccion: string;
  linea: Linea;
  /** Puntos del ramal desde Sé hasta la terminal. */
  puntos: [number, number][];
  /** Lado de la etiqueta respecto de la terminal. */
  lado: "izquierda" | "derecha";
  /** Texto corto bajo el nombre. */
  detalle: string;
}

const SE: [number, number] = [500, 220];

const RAMALES: Ramal[] = [
  {
    seccion: "transporte",
    linea: LINEAS.azul,
    puntos: [SE, [400, 120], [250, 120]],
    lado: "izquierda",
    detalle: "P1 · Cobertura y equipamientos",
  },
  {
    seccion: "mapa",
    linea: LINEAS.azul,
    puntos: [SE, [600, 320], [750, 320]],
    lado: "derecha",
    detalle: "Edificios y capas de GeoSampa",
  },
  {
    seccion: "invertir",
    linea: LINEAS.amarilla,
    puntos: [SE, [400, 320], [250, 320]],
    lado: "izquierda",
    detalle: "P2 · Dónde montar un negocio",
  },
  {
    seccion: "gente",
    linea: LINEAS.roja,
    puntos: [SE, [600, 120], [750, 120]],
    lado: "derecha",
    detalle: "Población, favelas, IDH, nacimientos",
  },
  {
    seccion: "ambiente",
    linea: LINEAS.verde,
    puntos: [SE, [750, 220]],
    lado: "derecha",
    detalle: "Vegetación y temperatura",
  },
  {
    seccion: "municipio",
    linea: LINEAS.lila,
    puntos: [SE, [250, 220]],
    lado: "izquierda",
    detalle: "Finanzas y red de salud",
  },
  {
    seccion: "fuentes",
    linea: LINEAS.plata,
    puntos: [SE, [500, 40]],
    lado: "derecha",
    detalle: "Catálogo y diccionario",
  },
  {
    seccion: "equidad",
    linea: LINEAS.coral,
    puntos: [SE, [500, 400]],
    lado: "derecha",
    detalle: "P3 · Favelas y servicios",
  },
];

const titulo = (id: string) => SECCIONES.find((s) => s.id === id)?.titulo ?? id;

export default function DiagramaRed() {
  return (
    <figure className="red">
      <svg viewBox="0 0 1000 440" className="red-svg">
        <title>Mapa de las secciones del sitio</title>
        {RAMALES.map((r, i) => {
          const [x, y] = r.puntos.at(-1)!;
          const d = `M${r.puntos.map((p) => p.join(",")).join("L")}`;
          const izquierda = r.lado === "izquierda";
          const tx = izquierda ? x - 20 : x + 20;
          return (
            <a key={r.seccion} href={`#${r.seccion}`} className="ramal" style={{ "--i": i } as React.CSSProperties}>
              <path d={d} pathLength={1} className="ramal-trazo" stroke={r.linea.color} />
              {/* Zona sensible más ancha que el trazo, para que el ramal sea fácil de señalar. */}
              <path d={d} className="ramal-toque" />
              <circle cx={x} cy={y} r={11} className="ramal-terminal" stroke={r.linea.color} />
              <text x={tx} y={y - 3} textAnchor={izquierda ? "end" : "start"} className="ramal-nombre">
                {titulo(r.seccion)}
              </text>
              <text x={tx} y={y + 16} textAnchor={izquierda ? "end" : "start"} className="ramal-detalle">
                {r.detalle}
              </text>
            </a>
          );
        })}
        {/* Sé: estás aquí. El anillo late para marcarlo, como el punto de «usted está aquí» de las placas. */}
        <a href="#panorama" className="red-se" aria-label="Panorama: estás aquí">
          <circle cx={SE[0]} cy={SE[1]} r={22} className="red-se-pulso" />
          <circle cx={SE[0]} cy={SE[1]} r={22} className="red-se-fondo" />
          <circle cx={SE[0]} cy={SE[1]} r={7} className="red-se-centro" />
        </a>
      </svg>

      {/* En pantallas angostas el diagrama no se lee: la misma red como lista de estaciones. */}
      <ol className="red-lista">
        {RAMALES.map((r) => (
          <li
            key={r.seccion}
            style={{ "--color-linea": r.linea.color, "--sobre-color-linea": r.linea.sobre } as React.CSSProperties}
          >
            <a href={`#${r.seccion}`}>
              <span className="red-lista-circulo" aria-hidden>
                {r.linea.numero}
              </span>
              <span>
                <strong>{titulo(r.seccion)}</strong>
                <span className="red-lista-detalle">{r.detalle}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
      <figcaption className="nota">
        Cada sección viaja en una línea del Metrô y lleva su color en mapas y gráficos. Panorama es Sé, donde se cruzan
        todas.
      </figcaption>
    </figure>
  );
}
