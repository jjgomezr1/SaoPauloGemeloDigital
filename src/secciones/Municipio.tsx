import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import BalanceAnual from "../componentes/BalanceAnual";
import BarraComposicion from "../componentes/BarraComposicion";
import CabeceraSeccion from "../componentes/CabeceraSeccion";
import Estaciones, { type Capitulo, SeccionCapitulo } from "../componentes/Estaciones";
import { ANIMACION, EJE, ESTILO_TOOLTIP, SERIE_1 } from "../componentes/graficos";
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

const CAPITULOS: Capitulo[] = [
  { id: "municipio-salud", titulo: "Salud" },
  { id: "municipio-finanzas", titulo: "Finanzas" },
];

/** Intensidad de una celda de la tabla de salud: raíz cuadrada para que las cifras chicas no desaparezcan. */
const intensidad = (v: number, max: number) => Math.round(8 + 62 * Math.sqrt(v / max));

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

  const maxRedTipo = useMemo(() => Math.max(1, ...(detalle?.salud ?? []).map((f) => f.establecimientos)), [detalle]);
  const conceptos = (tipo: string) =>
    (detalle?.finanzas ?? [])
      .filter((f) => f.tipo === tipo && f.valor_rs !== null)
      .map((f) => ({ etiqueta: f.concepto, valor: f.valor_rs ?? 0 }));

  const porRedTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of detalle?.salud ?? []) m.set(`${f.red}|${f.tipo_servicio}`, f.establecimientos);
    return m;
  }, [detalle]);

  if (sinDatos) {
    return (
      <section className="seccion">
        <CabeceraSeccion seccion="municipio" titulo="El municipio en cifras">
          <p className="entrada">
            Esta sección usa finanzas municipales (F04) y establecimientos de salud por red (F03). Sus datos se generan
            con el pipeline de ingesta (<code>npm run datos</code>); aún no están en esta copia del sitio.
          </p>
        </CabeceraSeccion>
      </section>
    );
  }

  return (
    <section className="seccion">
      <CabeceraSeccion
        seccion="municipio"
        titulo="El municipio en cifras"
        visual={<BalanceAnual serie={serieFinanzas} formato={formatearReales} />}
      >
        <p className="entrada">
          Cómo gasta e ingresa la ciudad y con qué red de salud cuenta. Son cifras del municipio en conjunto, sin
          desglose por distrito, tal como las publica la Prefeitura.
        </p>
      </CabeceraSeccion>

      <Estaciones capitulos={CAPITULOS} />

      <SeccionCapitulo id="municipio-salud">
        <h2 className="titulo-capitulo">Salud por red</h2>
        <div className="rejilla-tarjetas">
          <TarjetaIndicador
            titulo="Establecimientos de salud en la ciudad"
            indicador={busca("salud_establecimientos_total")}
            destacado
          />
          <TarjetaIndicador titulo="Red municipal" indicador={busca("salud_establecimientos_red_municipal")} />
          <TarjetaIndicador titulo="Red privada" indicador={busca("salud_establecimientos_red_privada")} />
        </div>

        <div className="panel">
          <h2>¿Quién sostiene la red de salud?</h2>
          <BarraComposicion
            descripcion="Establecimientos de salud por red"
            formato={(v) => `${formatoMiles.format(v)} establecimientos`}
            segmentos={[
              { etiqueta: "Municipal", valor: busca("salud_establecimientos_red_municipal")?.valor ?? 0 },
              { etiqueta: "Estadual", valor: busca("salud_establecimientos_red_estadual")?.valor ?? 0 },
              { etiqueta: "Privada", valor: busca("salud_establecimientos_red_privada")?.valor ?? 0 },
              { etiqueta: "Federal", valor: busca("salud_establecimientos_red_federal")?.valor ?? 0 },
            ]}
          />
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
                          <td
                            key={red}
                            className="num celda-calor"
                            style={
                              v === undefined
                                ? undefined
                                : ({ "--calor": `${intensidad(v, maxRedTipo)}%` } as React.CSSProperties)
                            }
                          >
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
      </SeccionCapitulo>

      <SeccionCapitulo id="municipio-finanzas">
        <h2 className="titulo-capitulo">Ingresos y gastos</h2>
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
                <YAxis width={88} tickFormatter={(v) => formatearReales(Number(v)).replace("R$ ", "")} {...EJE} />
                <Tooltip
                  formatter={(v, nombre) => [formatearReales(Number(v)), nombre]}
                  labelFormatter={(anio) => `Año ${anio}`}
                  {...ESTILO_TOOLTIP}
                />
                <Legend />
                <Line
                  name="Ingresos"
                  dataKey="ingresos"
                  stroke={SERIE_1}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: SERIE_1, strokeWidth: 2, stroke: "var(--superficie)" }}
                  {...ANIMACION}
                />
                <Line
                  name="Gastos"
                  dataKey="gastos"
                  stroke="var(--texto-tenue)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                  {...ANIMACION}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {detalle && detalle.finanzas.length > 0 && (
          <div className="rejilla-dos rejilla-pareja">
            <div className="panel">
              <h2>¿De dónde sale la plata? ({detalle.finanzas_anio})</h2>
              <BarraComposicion
                descripcion={`Ingresos de ${detalle.finanzas_anio} por concepto`}
                formato={formatearReales}
                segmentos={conceptos("Receita")}
              />
            </div>
            <div className="panel">
              <h2>¿En qué se gasta? ({detalle.finanzas_anio})</h2>
              <BarraComposicion
                descripcion={`Gastos de ${detalle.finanzas_anio} por concepto`}
                formato={formatearReales}
                segmentos={conceptos("Despesa")}
              />
            </div>
          </div>
        )}

        {detalle && detalle.finanzas.length > 0 && (
          <details className="panel desplegable">
            <summary>
              <h2>Tabla de ingresos y gastos por concepto ({detalle.finanzas_anio})</h2>
            </summary>
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
          </details>
        )}
      </SeccionCapitulo>

      <aside className="limitacion">
        <strong>Antes de comparar años:</strong> los valores de finanzas están en R$ corrientes, sin ajustar por
        inflación. Los ingresos son realizados y los gastos, empenhados. La salud cuenta establecimientos (no camas ni
        atenciones) y un mismo establecimiento puede ofrecer varios servicios.
      </aside>
    </section>
  );
}
