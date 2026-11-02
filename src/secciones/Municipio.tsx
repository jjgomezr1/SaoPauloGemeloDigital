import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EJE, ESTILO_TOOLTIP, SERIE_1 } from "../componentes/graficos";
import TarjetaIndicador from "../componentes/TarjetaIndicador";
import { type ArchivoIndicadores, cargar, claveIndicador, type Indicador } from "../datos";

// R$ en miles de millones y millones, para los ejes y las celdas de la tabla de finanzas.
const formatoMiles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const formatoUnDec = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

function formatearReales(valor: number | null): string {
  if (valor === null || Number.isNaN(valor)) return "Sin dato";
  if (Math.abs(valor) >= 1_000_000_000) return `R$ ${formatoUnDec.format(valor / 1_000_000_000)} mil mill.`;
  if (Math.abs(valor) >= 1_000_000) return `R$ ${formatoUnDec.format(valor / 1_000_000)} mill.`;
  return `R$ ${formatoMiles.format(valor)}`;
}

// El detalle (tablas) que publica build_web.py en indicadores/municipio/detalle.json.
interface FilaSalud {
  red: string;
  tipo_servicio: string;
  establecimientos: number;
}
interface FilaFinanzas {
  anio: number;
  tipo: string;
  concepto: string;
  valor_rs: number | null;
}
interface Detalle {
  salud_vigencia: string;
  finanzas_anio: number;
  salud: FilaSalud[];
  finanzas: FilaFinanzas[];
}

const REDES = ["Municipal", "Estadual", "Federal", "Privada"] as const;

export default function Municipio() {
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [sinDatos, setSinDatos] = useState(false);

  useEffect(() => {
    Promise.all([
      cargar<ArchivoIndicadores>("indicadores/municipio/indicadores.json"),
      cargar<Detalle>("indicadores/municipio/detalle.json"),
    ])
      .then(([ind, det]) => {
        setIndicadores(ind.indicadores);
        setDetalle(det);
      })
      // Mientras no se haya corrido el pipeline con datos (npm run datos), los JSON no existen.
      .catch(() => setSinDatos(true));
  }, []);

  const busca = (clave: string) => indicadores.find((i) => claveIndicador(i) === clave);

  // Ingresos y gastos por año, cruzados para el gráfico de dos líneas.
  const serieFinanzas = useMemo(() => {
    const porAnio = new Map<number, { anio: number; ingresos: number | null; gastos: number | null }>();
    for (const i of indicadores) {
      const clave = claveIndicador(i);
      if (clave !== "finanzas_ingresos" && clave !== "finanzas_gastos") continue;
      const anio = Number(i.vigencia);
      const fila = porAnio.get(anio) ?? { anio, ingresos: null, gastos: null };
      if (clave === "finanzas_ingresos") fila.ingresos = i.valor;
      else fila.gastos = i.valor;
      porAnio.set(anio, fila);
    }
    return [...porAnio.values()].sort((a, b) => a.anio - b.anio);
  }, [indicadores]);

  // Tipos de servicio que aparecen en al menos una red, para armar la tabla cruzada de salud.
  const tiposSalud = useMemo(() => {
    if (!detalle) return [];
    return [...new Set(detalle.salud.map((f) => f.tipo_servicio))].sort();
  }, [detalle]);

  const porRedTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of detalle?.salud ?? []) m.set(`${f.red}|${f.tipo_servicio}`, f.establecimientos);
    return m;
  }, [detalle]);

  if (sinDatos) {
    return (
      <section className="seccion">
        <header className="seccion-cabecera">
          <h1>El municipio en cifras</h1>
          <p className="entrada">
            Esta sección usa finanzas municipales (F04) y establecimientos de salud por red (F03). Sus datos se generan
            con el pipeline de ingesta (<code>npm run datos</code>); aún no están en esta copia del sitio.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="seccion">
      <header className="seccion-cabecera">
        <h1>El municipio en cifras</h1>
        <p className="entrada">
          Cómo gasta e ingresa la ciudad y con qué red de salud cuenta. Son cifras del municipio en conjunto, sin
          desglose por distrito, tal como las publica la Prefeitura.
        </p>
      </header>

      <h2 className="subtitulo">Salud por red</h2>
      <div className="rejilla-tarjetas">
        <TarjetaIndicador
          titulo="Establecimientos de salud en la ciudad"
          indicador={busca("salud_establecimientos_total")}
          destacado
        />
        <TarjetaIndicador titulo="Red municipal" indicador={busca("salud_establecimientos_red_municipal")} />
        <TarjetaIndicador titulo="Red privada" indicador={busca("salud_establecimientos_red_privada")} />
      </div>

      {detalle && detalle.salud.length > 0 && (
        <div className="panel">
          <h2>Establecimientos por red y tipo de servicio ({detalle.salud_vigencia})</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tipo de servicio</th>
                  {REDES.map((r) => (
                    <th key={r} scope="col" className="num">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiposSalud.map((tipo) => (
                  <tr key={tipo}>
                    <th scope="row">{tipo}</th>
                    {REDES.map((red) => {
                      const v = porRedTipo.get(`${red}|${tipo}`);
                      return (
                        <td key={red} className="num">
                          {v === undefined ? "–" : formatoMiles.format(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="subtitulo">Ingresos y gastos</h2>
      <div className="rejilla-tarjetas">
        <TarjetaIndicador
          titulo={`Ingresos ${serieFinanzas.at(-1)?.anio ?? ""}`}
          indicador={[...indicadores].reverse().find((i) => claveIndicador(i) === "finanzas_ingresos")}
          destacado
        />
        <TarjetaIndicador
          titulo={`Gastos ${serieFinanzas.at(-1)?.anio ?? ""}`}
          indicador={[...indicadores].reverse().find((i) => claveIndicador(i) === "finanzas_gastos")}
          destacado
        />
      </div>

      {serieFinanzas.length > 0 && (
        <div className="panel">
          <h2>Ingresos y gastos del municipio por año</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={serieFinanzas} margin={{ left: 16, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grilla)" />
              <XAxis dataKey="anio" type="number" domain={["dataMin", "dataMax"]} {...EJE} />
              <YAxis
                width={88}
                tickFormatter={(v) => formatearReales(Number(v)).replace("R$ ", "")}
                {...EJE}
              />
              <Tooltip
                formatter={(v, nombre) => [formatearReales(Number(v)), nombre]}
                labelFormatter={(anio) => `Año ${anio}`}
                {...ESTILO_TOOLTIP}
              />
              <Legend />
              <Line name="Ingresos" dataKey="ingresos" stroke={SERIE_1} strokeWidth={2} dot={{ r: 3 }} />
              <Line
                name="Gastos"
                dataKey="gastos"
                stroke="var(--texto-tenue)"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {detalle && detalle.finanzas.length > 0 && (
        <div className="panel">
          <h2>Ingresos y gastos por concepto ({detalle.finanzas_anio})</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Concepto</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...detalle.finanzas]
                  .sort((a, b) => (b.valor_rs ?? 0) - (a.valor_rs ?? 0))
                  .map((f) => (
                    <tr key={`${f.tipo}-${f.concepto}`}>
                      <th scope="row">{f.concepto}</th>
                      <td>{f.tipo === "Receita" ? "Ingreso" : "Gasto"}</td>
                      <td className="num">{formatearReales(f.valor_rs)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <aside className="limitacion">
        <strong>Antes de comparar años:</strong> los valores de finanzas están en R$ corrientes, sin ajustar por
        inflación. Los ingresos son realizados y los gastos, empenhados. La salud cuenta establecimientos (no camas ni
        atenciones) y un mismo establecimiento puede ofrecer varios servicios.
      </aside>
    </section>
  );
}
