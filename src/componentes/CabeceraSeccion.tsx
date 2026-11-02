import type { ReactNode } from "react";
import { lineaDe } from "../lineas";
import CodigoPregunta from "./CodigoPregunta";

interface Props {
  /** Id de la sección (rutas.ts): decide la línea del Metrô. */
  seccion: string;
  titulo: string;
  pregunta?: "P1" | "P2";
  children?: ReactNode;
  /** Pieza visual propia de la sección, a la derecha del texto (abajo en móvil). */
  visual?: ReactNode;
}

/**
 * Cabecera de sección como placa de estación: franja del color de la línea, círculo con el número y el
 * nombre de la línea. Cada sección tiene la suya y una pieza visual distinta al lado.
 */
export default function CabeceraSeccion({ seccion, titulo, pregunta, children, visual }: Props) {
  const linea = lineaDe(seccion);
  return (
    <header className={visual ? "placa con-visual" : "placa"}>
      <div className="placa-texto">
        <p className="placa-rotulo">
          <span className="placa-circulo" aria-hidden>
            {linea.numero}
          </span>
          <span className="placa-linea">
            Linha {linea.numero} · {linea.nombre}
          </span>
          {pregunta && (
            <span className="placa-pregunta">
              <CodigoPregunta codigo={pregunta} /> Pregunta {pregunta.slice(1)}
            </span>
          )}
        </p>
        <h1>{titulo}</h1>
        {children}
      </div>
      {visual && <div className="placa-visual">{visual}</div>}
    </header>
  );
}
