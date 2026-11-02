interface Fila {
  anio: number;
  ingresos: number | null;
  gastos: number | null;
}

interface Props {
  serie: Fila[];
  formato: (valor: number) => string;
}

/**
 * Resultado de cada año (ingresos menos gastos) en barras divergentes desde una línea de cero: hacia arriba
 * el superávit, en el color de la línea; hacia abajo el déficit, en tono de alerta.
 */
export default function BalanceAnual({ serie, formato }: Props) {
  const filas = serie
    .filter((f) => f.ingresos !== null && f.gastos !== null)
    .map((f) => ({ anio: f.anio, saldo: (f.ingresos ?? 0) - (f.gastos ?? 0) }));
  if (!filas.length) return null;
  const max = Math.max(...filas.map((f) => Math.abs(f.saldo)));
  const ultimo = filas.at(-1)!;
  const superavits = filas.filter((f) => f.saldo >= 0).length;

  return (
    <figure className="balance">
      <p className="balance-cifra">
        <span className="balance-numero">
          {superavits} de {filas.length}
        </span>
        <span className="balance-texto">
          años cerraron con más ingresos que gastos ({filas[0].anio}-{ultimo.anio})
        </span>
      </p>
      <ol className="balance-barras">
        {filas.map((f, i) => {
          const alto = max ? (50 * Math.abs(f.saldo)) / max : 0;
          return (
            <li
              key={f.anio}
              className={f.saldo >= 0 ? "superavit" : "deficit"}
              title={`${f.anio}: ${f.saldo >= 0 ? "superávit" : "déficit"} de ${formato(Math.abs(f.saldo))}`}
              style={{ "--alto": `${Math.max(alto, 1.5)}%`, "--i": i } as React.CSSProperties}
            >
              <span className="balance-barra" />
              <span className="balance-anio">{String(f.anio).slice(2)}</span>
              <span className="solo-lector">
                {f.anio}: {f.saldo >= 0 ? "superávit" : "déficit"} de {formato(Math.abs(f.saldo))}
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className="balance-leyenda">
        <span>
          <span className="muestra superavit" /> Superávit
        </span>
        <span>
          <span className="muestra deficit" /> Déficit
        </span>
        <span className="nota">R$ corrientes; gastos empenhados.</span>
      </figcaption>
    </figure>
  );
}
