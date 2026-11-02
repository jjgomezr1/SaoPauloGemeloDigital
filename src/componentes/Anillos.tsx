import { formatear, type Indicador } from "../datos";

interface Anillo {
  etiqueta: string;
  indicador?: Indicador;
}

interface Props {
  anillos: Anillo[];
  territorio: string;
}

const GROSOR = 13;
const SEPARACION = 4;
const RADIO_EXTERIOR = 92;

/**
 * Anillos concéntricos de porcentaje, del exterior al interior. Cada anillo se llena hasta su valor con una
 * transición: al cambiar de distrito los tres se mueven a la vez. Los porcentajes van escritos al lado.
 */
export default function Anillos({ anillos, territorio }: Props) {
  const tam = (RADIO_EXTERIOR + GROSOR) * 2;
  const centro = tam / 2;
  return (
    <figure className="anillos">
      <svg viewBox={`0 0 ${tam} ${tam}`} className="anillos-svg" aria-hidden>
        {anillos.map((a, i) => {
          const r = RADIO_EXTERIOR - i * (GROSOR + SEPARACION);
          const valor = Math.max(0, Math.min(100, a.indicador?.valor ?? 0));
          return (
            <g key={a.etiqueta} className={`anillo anillo-${i + 1}`}>
              <circle cx={centro} cy={centro} r={r} pathLength={100} className="anillo-pista" strokeWidth={GROSOR} />
              <circle
                cx={centro}
                cy={centro}
                r={r}
                pathLength={100}
                className="anillo-valor"
                strokeWidth={GROSOR}
                strokeDasharray="100 100"
                style={{ strokeDashoffset: 100 - valor }}
                transform={`rotate(-90 ${centro} ${centro})`}
              />
            </g>
          );
        })}
      </svg>
      <figcaption>
        <p className="anillos-territorio">{territorio}</p>
        <ul>
          {anillos.map((a, i) => (
            <li key={a.etiqueta} className={`anillo-${i + 1}`}>
              <span className="anillos-cifra">
                {a.indicador ? formatear(a.indicador.valor, a.indicador.unidad) : "…"}
              </span>
              <span className="anillos-etiqueta">{a.etiqueta}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
