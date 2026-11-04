import type { ReactNode } from "react";
import CodigoPregunta from "./CodigoPregunta";

interface Props {
  /** Id de la sección (rutas.ts). El color lo pone App.tsx en :root[data-linea]. */
  seccion: string;
  titulo: string;
  pregunta?: "P1" | "P2" | "P3";
  children?: ReactNode;
  /** Pieza visual propia de la sección, a la derecha del texto (abajo en móvil). */
  visual?: ReactNode;
  /** Placa baja, para las secciones donde lo principal viene justo debajo (el mapa 3D). */
  compacta?: boolean;
}

/**
 * Cabecera de sección. El color de la sección (su línea del Metrô) viene de estilos.css; el rótulo solo dice a
 * qué pregunta responde, si responde a una. Cada sección tiene una pieza visual distinta al lado.
 */
export default function CabeceraSeccion({ titulo, pregunta, children, visual, compacta }: Props) {
  return (
    <header className={["placa", visual ? "con-visual" : "", compacta ? "compacta" : ""].join(" ").trim()}>
      <div className="placa-texto">
        {pregunta && (
          <p className="placa-rotulo">
            <span className="placa-pregunta">
              <CodigoPregunta codigo={pregunta} /> Pregunta {pregunta.slice(1)}
            </span>
          </p>
        )}
        <h1>{titulo}</h1>
        {children}
      </div>
      {visual && <div className="placa-visual">{visual}</div>}
    </header>
  );
}
