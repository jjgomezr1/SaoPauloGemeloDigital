import { useState } from "react";
import { formatear } from "../datos";

interface Anio {
  anio: number;
  valor: number | null;
}

interface Props {
  serie: Anio[];
  normal: number | null;
  /** Rótulo de la normal: «1991-2020». */
  periodoNormal: string;
  seleccionado?: string;
  onSeleccionar: (anio: string) => void;
}

// Franjas de calentamiento (Ed Hawkins): un año por franja, del azul (más frío que la normal) al rojo (más
// cálido). Escala divergente centrada en la normal, simétrica: ±ESCALA °C llega al tono más intenso.
const FRIO = ["#08306b", "#08519c", "#2171b5", "#4292c6", "#6baed6", "#9ecae1", "#c6dbef", "#deebf7"];
const CALIDO = ["#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"];
const ESCALA = 1.6;

function colorAnomalia(diferencia: number): string {
  const t = Math.max(-1, Math.min(1, diferencia / ESCALA));
  if (t < 0) return FRIO[Math.min(FRIO.length - 1, Math.floor((1 + t) * FRIO.length))];
  return CALIDO[Math.min(CALIDO.length - 1, Math.floor(t * CALIDO.length))];
}

const firmado = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${formatear(Math.abs(v))} °C`;

/** Las franjas son botones: elegir una cambia el año del resto de la sección. */
export default function FranjasClima({ serie, normal, periodoNormal, seleccionado, onSeleccionar }: Props) {
  const [encima, setEncima] = useState<{ anio: number; valor: number } | null>(null);
  const datos = serie.filter((a): a is { anio: number; valor: number } => a.valor !== null);
  if (!datos.length || normal === null) return <div className="franjas cargando-franjas" />;

  const foco = encima ?? datos.find((a) => String(a.anio) === seleccionado) ?? datos.at(-1)!;
  const diferencia = foco.valor - normal;

  return (
    <figure className="franjas">
      <div className="franjas-cabecera">
        <p className="franjas-anio">{foco.anio}</p>
        <p className="franjas-dato">
          <strong>{formatear(foco.valor)} °C</strong> de mínima media ·{" "}
          <span className={diferencia >= 0 ? "calido" : "frio"}>{firmado(diferencia)}</span> frente a la normal
        </p>
      </div>
      <fieldset className="franjas-banda">
        <legend className="solo-lector">Temperatura mínima media de cada año</legend>
        {datos.map((a) => (
          <button
            key={a.anio}
            type="button"
            className={String(a.anio) === seleccionado ? "franja activa" : "franja"}
            style={{ background: colorAnomalia(a.valor - normal) }}
            onClick={() => onSeleccionar(String(a.anio))}
            onMouseEnter={() => setEncima(a)}
            onMouseLeave={() => setEncima(null)}
            onFocus={() => setEncima(a)}
            onBlur={() => setEncima(null)}
            aria-label={`${a.anio}: ${formatear(a.valor)} °C, ${firmado(a.valor - normal)} frente a la normal`}
            aria-pressed={String(a.anio) === seleccionado}
          />
        ))}
      </fieldset>
      <figcaption className="franjas-pie">
        <span>{datos[0].anio}</span>
        <span className="franjas-escala" aria-hidden>
          <span>más fría</span>
          <span className="franjas-degradado" />
          <span>más cálida que la normal {periodoNormal}</span>
        </span>
        <span>{datos.at(-1)!.anio}</span>
      </figcaption>
    </figure>
  );
}
