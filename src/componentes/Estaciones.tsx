import { useEffect, useState } from "react";

export interface Capitulo {
  id: string;
  titulo: string;
}

interface Props {
  capitulos: Capitulo[];
}

// Las rutas viven en el hash, así que los capítulos no pueden ser enlaces #id: el botón desplaza la página.
function irA(id: string) {
  const destino = document.getElementById(id);
  if (!destino) return;
  const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  destino.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  destino.focus({ preventScroll: true });
}

/**
 * Índice de capítulos como el diagrama de una línea: cada capítulo es una estación. Se queda pegado bajo la
 * cabecera y marca la estación en la que va el lector; las ya recorridas quedan con la línea llena.
 */
export default function Estaciones({ capitulos }: Props) {
  const [actual, setActual] = useState<string | undefined>(capitulos[0]?.id);

  useEffect(() => {
    // La estación actual es el último capítulo cuyo comienzo ya pasó el primer tercio de la pantalla.
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const umbral = window.innerHeight * 0.35;
      let elegido: string | undefined = capitulos[0]?.id;
      for (const c of capitulos) {
        const e = document.getElementById(c.id);
        if (e && e.getBoundingClientRect().top <= umbral) elegido = c.id;
      }
      // Al final de la página el último capítulo puede no llegar al umbral: se marca igual.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        elegido = capitulos.at(-1)?.id;
      }
      setActual(elegido);
    };
    const alDesplazar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    window.addEventListener("resize", alDesplazar);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("scroll", alDesplazar);
      window.removeEventListener("resize", alDesplazar);
    };
  }, [capitulos]);

  const indiceActual = Math.max(
    0,
    capitulos.findIndex((c) => c.id === actual),
  );

  return (
    <nav className="estaciones" aria-label="Capítulos de la sección">
      <ol
        style={
          {
            "--avance": capitulos.length > 1 ? indiceActual / (capitulos.length - 1) : 1,
            "--n": capitulos.length,
          } as React.CSSProperties
        }
      >
        {capitulos.map((c, i) => (
          <li key={c.id} className={i < indiceActual ? "pasada" : i === indiceActual ? "actual" : ""}>
            <button type="button" onClick={() => irA(c.id)} aria-current={i === indiceActual ? "step" : undefined}>
              <span className="estacion-punto" aria-hidden />
              <span className="estacion-nombre">{c.titulo}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Contenedor de un capítulo: ancla para el índice y separación con el anterior. */
export function SeccionCapitulo({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="capitulo" tabIndex={-1}>
      {children}
    </div>
  );
}
