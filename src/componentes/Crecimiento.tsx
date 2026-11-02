import { formatear, formatearCorto } from "../datos";

interface Punto {
  anio: number;
  valor: number | null;
}

interface Props {
  serie: Punto[];
}

const ANCHO = 400;
const ALTO = 150;

/**
 * La población de la ciudad desde el primer censo en una sola cifra (cuántas veces se multiplicó) y una
 * curva de área sobre un eje de años real: los censos no son equidistantes.
 */
export default function Crecimiento({ serie }: Props) {
  const puntos = serie.filter((p): p is { anio: number; valor: number } => p.valor !== null);
  if (puntos.length < 2) return <div className="crecimiento" />;
  const [primero, ultimo] = [puntos[0], puntos.at(-1)!];
  const max = Math.max(...puntos.map((p) => p.valor));
  const x = (anio: number) => ((anio - primero.anio) / (ultimo.anio - primero.anio)) * ANCHO;
  const y = (v: number) => ALTO - (v / max) * (ALTO - 8);
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(p.anio).toFixed(1)},${y(p.valor).toFixed(1)}`).join("");
  const area = `${linea}L${ANCHO},${ALTO}L0,${ALTO}Z`;
  const veces = Math.round(ultimo.valor / primero.valor);

  return (
    <figure className="crecimiento">
      <p className="crecimiento-cifra">
        <span className="crecimiento-numero">×{formatear(veces)}</span>
        <span className="crecimiento-texto">
          creció la población de la ciudad entre el censo de {primero.anio} y el de {ultimo.anio}
        </span>
      </p>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO + 22}`} className="crecimiento-svg" aria-hidden>
        <defs>
          <linearGradient id="crecimiento-relleno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--serie-seccion)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--serie-seccion)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#crecimiento-relleno)" />
        <path d={linea} className="crecimiento-linea" pathLength={1} />
        {puntos.map((p) => (
          <circle key={p.anio} cx={x(p.anio)} cy={y(p.valor)} r={2.5} className="crecimiento-punto" />
        ))}
        <text x={0} y={ALTO + 18} className="crecimiento-eje">
          {primero.anio} · {formatearCorto(primero.valor)}
        </text>
        <text x={ANCHO} y={ALTO + 18} textAnchor="end" className="crecimiento-eje">
          {ultimo.anio} · {formatearCorto(ultimo.valor)}
        </text>
      </svg>
    </figure>
  );
}
