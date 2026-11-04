export interface Segmento {
  etiqueta: string;
  valor: number;
  /** Color propio del segmento; sin él, sale un tono de la línea de la sección. */
  color?: string;
}

interface Props {
  segmentos: Segmento[];
  /** Cómo se escribe el valor absoluto en la leyenda; sin él se muestra solo el porcentaje. */
  formato?: (valor: number) => string;
  /** Texto para lectores de pantalla: «Ingresos de 2025 por concepto». */
  descripcion: string;
  /** Si los valores ya son porcentajes (suman ~100), no se recalculan. */
  sonPorcentajes?: boolean;
}

const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
// Una parte que existe no puede leerse «0 %»: bajo 0,05 % se escribe «<0,1».
const fmtPct = { format: (v: number) => (v > 0 && v < 0.05 ? "<0,1" : fmt.format(v)) };

/**
 * Una sola barra al 100 % partida en segmentos, como la del almacenamiento de un teléfono: deja ver de un
 * vistazo cuánto pesa cada parte. Los tonos salen del color de la línea, del más fuerte al más tenue, y la
 * leyenda debajo trae el porcentaje exacto.
 */
export default function BarraComposicion({ segmentos, formato, descripcion, sonPorcentajes }: Props) {
  const orden = [...segmentos].filter((s) => s.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = sonPorcentajes ? 100 : orden.reduce((s, x) => s + x.valor, 0);
  if (!orden.length || !total) return null;

  // Del 100 % al 22 % del color de la línea, mezclado con la superficie.
  const tono = (i: number) => {
    const p = orden.length === 1 ? 100 : Math.round(100 - (78 * i) / (orden.length - 1));
    return `color-mix(in srgb, var(--serie-seccion) ${p}%, var(--superficie-2))`;
  };

  return (
    <div className="composicion">
      <div className="composicion-barra" role="img" aria-label={descripcion}>
        {orden.map((s, i) => (
          <span
            key={s.etiqueta}
            style={{ flexGrow: s.valor, background: s.color ?? tono(i), animationDelay: `${i * 60}ms` }}
            title={`${s.etiqueta}: ${fmtPct.format((100 * s.valor) / total)} %`}
          />
        ))}
      </div>
      <ul className="composicion-leyenda">
        {orden.map((s, i) => (
          <li key={s.etiqueta}>
            <span className="muestra" style={{ background: s.color ?? tono(i) }} />
            <span className="composicion-etiqueta">{s.etiqueta}</span>
            <span className="composicion-pct">{fmtPct.format((100 * s.valor) / total)} %</span>
            {formato && <span className="composicion-valor">{formato(s.valor)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
