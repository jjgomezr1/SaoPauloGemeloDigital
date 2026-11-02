import { formatear, type Indicador } from "../datos";

interface Props {
  /** Ya ordenado de mayor a menor. */
  ranking: (Indicador & { valor: number })[];
  anio?: string;
  /** Cuántos distritos se resaltan. */
  primeros?: number;
  seleccionado: string | null;
  onSeleccionar: (codigo: string) => void;
}

const fmtPct = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/**
 * Los 96 distritos como una rejilla de 96 casillas, de mayor a menor: la intensidad de cada una es su peso
 * en el total. Arriba, la cifra que resume la concentración: qué parte del total suman los primeros.
 * Cada casilla es un botón que selecciona el distrito.
 */
export default function ConcentracionDistritos({ ranking, anio, primeros = 10, seleccionado, onSeleccionar }: Props) {
  const total = ranking.reduce((s, i) => s + i.valor, 0);
  const max = ranking[0]?.valor ?? 1;
  const suma = ranking.slice(0, primeros).reduce((s, i) => s + i.valor, 0);
  const pct = total ? (100 * suma) / total : 0;

  return (
    <figure className="concentracion">
      <p className="concentracion-cifra">
        <span className="concentracion-numero">{total ? `${fmtPct.format(pct)} %` : "…"}</span>
        <span className="concentracion-texto">
          de los empleos formales{anio ? ` de ${anio}` : ""} está en {primeros} de los {ranking.length || 96} distritos
        </span>
      </p>
      <fieldset className="concentracion-rejilla">
        <legend className="solo-lector">Distritos ordenados por empleos formales</legend>
        {ranking.map((i, n) => (
          <button
            key={i.codigo_territorio}
            type="button"
            className={[
              "casilla",
              n < primeros ? "primeros" : "",
              i.codigo_territorio === seleccionado ? "seleccionada" : "",
            ].join(" ")}
            // Raíz cuadrada: con escala lineal casi todas las casillas quedarían en blanco frente a Itaim Bibi.
            style={{ "--peso": Math.sqrt(i.valor / max), "--n": n } as React.CSSProperties}
            onClick={() => onSeleccionar(i.codigo_territorio)}
            title={`${n + 1}. ${i.nombre_territorio}: ${formatear(i.valor)} empleos`}
            aria-label={`${n + 1}. ${i.nombre_territorio}: ${formatear(i.valor)} empleos`}
          />
        ))}
      </fieldset>
      <figcaption className="nota">
        Cada casilla es un distrito, de más a menos empleos. Las {primeros} primeras van en el color de la línea.
      </figcaption>
    </figure>
  );
}
