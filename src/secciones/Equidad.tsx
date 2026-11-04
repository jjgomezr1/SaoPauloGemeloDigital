import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import BarraComposicion from "../componentes/BarraComposicion";
import CabeceraSeccion from "../componentes/CabeceraSeccion";
import Estaciones, { type Capitulo, SeccionCapitulo } from "../componentes/Estaciones";
import { EJE, ESTILO_TOOLTIP, SERIE_1 } from "../componentes/graficos";
import MapaDistritos from "../componentes/MapaDistritos";
import { NotaMetodo } from "../componentes/notas";
import RankingDistritos from "../componentes/RankingDistritos";
import SelectorAnio from "../componentes/SelectorAnio";
import TarjetaIndicador from "../componentes/TarjetaIndicador";
import {
  type ArchivoIndicadores,
  cargar,
  claveIndicador,
  formatear,
  type Indicador,
  metricaPorTerritorio,
  tieneValor,
} from "../datos";
import { useParametro } from "../rutas";

const CAPITULOS: Capitulo[] = [
  { id: "equidad-comparacion", titulo: "Dos ciudades" },
  { id: "equidad-empleo", titulo: "Quién trabaja" },
];

// Las tasas de build_web.py (TASAS_EQUIDAD), en el orden en que se leen mejor.
const TASAS = [
  { clave: "cobertura_poblacion_metro", etiqueta: "Población cerca del metro" },
  { clave: "empleos_por_hab", etiqueta: "Empleos por habitante" },
  { clave: "centros_deportivos_por_100mil", etiqueta: "Centros deportivos por 100 mil habitantes" },
  { clave: "escuelas_infantil_por_10mil", etiqueta: "Escuelas infantiles públicas por 10 mil habitantes" },
  { clave: "escuelas_basica_por_10mil", etiqueta: "Escuelas públicas fundamental y media por 10 mil habitantes" },
  { clave: "cobertura_poblacion", etiqueta: "Población cerca de bus o metro" },
] as const;

const GRUPOS = [
  { codigo: "mas_favelas", etiqueta: "Con más favelas" },
  { codigo: "MSP", etiqueta: "Toda la ciudad" },
  { codigo: "menos_favelas", etiqueta: "Con menos favelas" },
];

// Colores categóricos fijos por grupo, para que no cambien de un año a otro. Ninguno imita un tono de piel ni el
// nombre de la categoría («Amarilla» no va en amarillo).
const RAZAS = [
  { clave: "branca", etiqueta: "Blanca", color: "#3b6fd4" },
  { clave: "parda", etiqueta: "Parda", color: "#e07a1f" },
  { clave: "preta", etiqueta: "Preta", color: "#1a9a78" },
  { clave: "amarela", etiqueta: "Amarilla", color: "#9b3894" },
  { clave: "indigena", etiqueta: "Indígena", color: "#c2a11f" },
  { clave: "nao_identificada", etiqueta: "No identificada", color: "#8b8e94" },
];
const ANIOS_RAZA = ["2023", "2024"];

interface Cabecera {
  corte_mas_favelas_pct: number;
  corte_menos_favelas_pct: number;
}

const unDecimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** Cuántas veces más tiene un grupo que el otro: «8 veces más», o «2,6 veces menos». */
function veces(a?: number | null, b?: number | null): string {
  if (!a || !b) return "…";
  const r = a / b;
  return r >= 1 ? `${unDecimal.format(r)} veces más` : `${unDecimal.format(1 / r)} veces menos`;
}

// La cabecera pone las «dos ciudades» espalda con espalda: a la izquierda los distritos con más favelas, a la
// derecha los de menos, una fila por tema. Cada fila tiene su propia escala (de 0 al valor más alto de los dos),
// porque las unidades no se comparan entre sí. La cifra grande es la brecha del primer tema.
const BRECHAS = [
  { clave: "cobertura_poblacion_metro", etiqueta: "Población cerca del metro", unidad: "%" },
  { clave: "empleos_por_hab", etiqueta: "Empleos por habitante", unidad: "" },
  { clave: "centros_deportivos_por_100mil", etiqueta: "Centros deportivos por 100 mil hab.", unidad: "" },
  { clave: "escuelas_infantil_por_10mil", etiqueta: "Escuelas infantiles públicas por 10 mil hab.", unidad: "" },
];

function Brechas({ valor }: { valor: (grupo: string, clave: string) => number | undefined }) {
  const metroMas = valor("mas_favelas", BRECHAS[0].clave);
  const metroMenos = valor("menos_favelas", BRECHAS[0].clave);
  const brecha = metroMas && metroMenos ? `×${formatear(Math.round(metroMenos / metroMas))}` : "…";

  return (
    <figure className="brechas">
      <p className="brechas-cifra">
        <span className="brechas-numero">{brecha}</span>
        <span className="brechas-texto">
          más población cerca del metro en los distritos con menos favelas que en los de más
        </span>
      </p>
      <div className="brechas-leyenda" aria-hidden>
        <span className="brechas-grupo">
          <span className="brechas-muestra brechas-mas" /> Más favelas
        </span>
        <span className="brechas-grupo brechas-grupo-menos">
          Menos favelas <span className="brechas-muestra brechas-menos" />
        </span>
      </div>
      <ul>
        {BRECHAS.map((b) => {
          const mas = valor("mas_favelas", b.clave);
          const menos = valor("menos_favelas", b.clave);
          const tope = Math.max(mas ?? 0, menos ?? 0) || 1;
          const ancho = (v?: number) => `${((v ?? 0) / tope) * 100}%`;
          const texto = (v?: number) => (v === undefined ? "…" : `${unDecimal.format(v)}${b.unidad ? " %" : ""}`);
          return (
            <li key={b.clave}>
              <span className="brechas-etiqueta">{b.etiqueta}</span>
              <span
                className="brechas-fila"
                role="img"
                aria-label={`${b.etiqueta}: ${texto(mas)} en los distritos con más favelas y ${texto(menos)} en los de menos`}
              >
                <span className="brechas-valor brechas-valor-mas">{texto(mas)}</span>
                <span className="brechas-lado brechas-lado-mas">
                  <span className="brechas-barra brechas-mas" style={{ width: ancho(mas) }} />
                </span>
                <span className="brechas-lado brechas-lado-menos">
                  <span className="brechas-barra brechas-menos" style={{ width: ancho(menos) }} />
                </span>
                <span className="brechas-valor">{texto(menos)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export default function Equidad() {
  const [datos, setDatos] = useState<Indicador[]>([]);
  const [cortes, setCortes] = useState<Cabecera>();
  const [tasaUrl, setTasa] = useParametro("tasa");
  const [anioUrl, setAnio] = useParametro("anio");
  const [distrito, setDistrito] = useParametro("distrito");
  const [empleo, setEmpleo] = useState<Indicador[]>([]);
  const tasa = TASAS.find((t) => t.clave === tasaUrl) ?? TASAS[0];
  const anio = anioUrl && ANIOS_RAZA.includes(anioUrl) ? anioUrl : ANIOS_RAZA.at(-1);

  useEffect(() => {
    cargar<ArchivoIndicadores & Cabecera>("indicadores/equidad/grupos.json").then((a) => {
      setDatos(a.indicadores);
      setCortes({ corte_mas_favelas_pct: a.corte_mas_favelas_pct, corte_menos_favelas_pct: a.corte_menos_favelas_pct });
    });
  }, []);

  useEffect(() => {
    cargar<ArchivoIndicadores>(`indicadores/empleo/anio_${anio}.json`).then((a) => setEmpleo(a.indicadores));
  }, [anio]);

  const grupo = (codigo: string, clave: string) =>
    datos.find((i) => i.codigo_territorio === codigo && claveIndicador(i) === clave);

  // Un punto por distrito: % de domicilios en favelas contra la tasa elegida.
  const puntos = useMemo(() => {
    const favelas = Object.fromEntries(
      datos
        .filter((i) => i.nivel === "distrito" && claveIndicador(i) === "domicilios_favela_pct")
        .map((i) => [i.codigo_territorio, i.valor]),
    );
    return datos
      .filter((i) => i.nivel === "distrito" && claveIndicador(i) === tasa.clave && tieneValor(i))
      .map((i) => ({ x: favelas[i.codigo_territorio], y: i.valor, nombre: i.nombre_territorio }));
  }, [datos, tasa.clave]);
  const unidadTasa = grupo("MSP", tasa.clave)?.unidad ?? "";

  const raza = useMemo(() => metricaPorTerritorio(empleo, "empleos_raza_preta_parda_pct"), [empleo]);
  const territorio = distrito ?? "MSP";
  const buscaEmpleo = (clave: string) =>
    empleo.find((i) => i.codigo_territorio === territorio && claveIndicador(i) === clave);
  const nombreTerritorio = buscaEmpleo("empleos_formales")?.nombre_territorio ?? "Município de São Paulo";
  const razas = RAZAS.map((r) => ({ ...r, indicador: buscaEmpleo(`empleos_raza_${r.clave}_pct`) }));

  return (
    <section className="seccion">
      <CabeceraSeccion
        seccion="equidad"
        pregunta="P3"
        titulo="¿Los distritos con más favelas reciben menos?"
        visual={<Brechas valor={(g, c) => grupo(g, c)?.valor ?? undefined} />}
      >
        <p className="entrada">
          Se compara el 25 % de los distritos con más domicilios en favelas con el 25 % con menos: transporte, empleo,
          deporte y escuelas públicas, cada tasa calculada sobre la población de todo el grupo.
        </p>
      </CabeceraSeccion>

      <Estaciones capitulos={CAPITULOS} />

      <SeccionCapitulo id="equidad-comparacion">
        <p className="porque">
          <strong>Por qué importa:</strong> dice dónde falta inversión pública. Si los distritos con más favelas tienen
          menos metro, menos empleo y menos deporte, su gente paga con tiempo y oportunidades lo que la ciudad no puso.
        </p>

        <div className="filtros">
          <label>
            Comparar
            <select value={tasa.clave} onChange={(e) => setTasa(e.target.value)}>
              {TASAS.map((t) => (
                <option key={t.clave} value={t.clave}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rejilla-tarjetas">
          {GRUPOS.map((g) => (
            <TarjetaIndicador
              key={g.codigo}
              titulo={`${tasa.etiqueta}: ${g.etiqueta.toLowerCase()}`}
              indicador={grupo(g.codigo, tasa.clave)}
              destacado={g.codigo === "mas_favelas"}
            />
          ))}
        </div>
        <p className="contraste-lectura">
          Los distritos con menos favelas tienen{" "}
          <strong>{veces(grupo("menos_favelas", tasa.clave)?.valor, grupo("mas_favelas", tasa.clave)?.valor)}</strong>{" "}
          {tasa.etiqueta.toLowerCase()} que los distritos con más favelas.
        </p>

        <div className="panel">
          <h2>{tasa.etiqueta} y domicilios en favelas, por distrito</h2>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--grilla)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Domicilios en favelas"
                unit=" %"
                {...EJE}
                label={{ value: "% de domicilios en favelas", position: "insideBottom", offset: -4, fontSize: 12 }}
              />
              <YAxis type="number" dataKey="y" name={tasa.etiqueta} width={56} {...EJE} />
              <ZAxis range={[46, 46]} />
              <Tooltip
                {...ESTILO_TOOLTIP}
                formatter={(v, nombre) =>
                  nombre === "Domicilios en favelas"
                    ? [formatear(Number(v), "%"), nombre]
                    : [`${formatear(Number(v))} ${unidadTasa}`, tasa.etiqueta]
                }
                labelFormatter={() => ""}
                cursor={{ strokeDasharray: "4 4" }}
              />
              <Scatter data={puntos} fill={SERIE_1} fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="nota">
            Cada punto es un distrito. Más a la derecha, más domicilios en favelas; más arriba, más{" "}
            {tasa.etiqueta.toLowerCase()}.
          </p>
        </div>
      </SeccionCapitulo>

      <SeccionCapitulo id="equidad-empleo">
        <h2 className="titulo-capitulo">¿Quién ocupa los empleos?</h2>
        <p className="porque">
          <strong>Por qué importa:</strong> la desigualdad también se mide en quién ocupa los empleos formales y en qué
          distritos: muestra si el empleo con registro llega por igual a todos los grupos.
        </p>

        <SelectorAnio etiqueta="Año" anios={ANIOS_RAZA} valor={anio} onCambiar={setAnio} />

        {distrito && (
          <div className="filtros">
            <button type="button" className="boton-secundario" onClick={() => setDistrito(null)}>
              Volver al municipio
            </button>
          </div>
        )}

        <div className="rejilla-tarjetas">
          <TarjetaIndicador
            titulo={`Empleos de personas pretas o pardas en ${nombreTerritorio}`}
            indicador={buscaEmpleo("empleos_raza_preta_parda_pct")}
            destacado
          />
          <TarjetaIndicador titulo="Empleos ocupados por mujeres" indicador={buscaEmpleo("empleos_femenino_pct")} />
        </div>

        <div className="panel">
          <h2>
            Empleos por raza o color en {nombreTerritorio}, {anio}
          </h2>
          <BarraComposicion
            descripcion={`Empleos por raza o color en ${nombreTerritorio}, ${anio}`}
            sonPorcentajes
            segmentos={razas
              .filter((r) => r.indicador && tieneValor(r.indicador))
              .map((r) => ({ etiqueta: r.etiqueta, valor: r.indicador?.valor ?? 0, color: r.color }))}
          />
        </div>

        <div className="rejilla-dos">
          <div className="panel">
            <h2>Empleos de personas pretas o pardas por distrito, {anio}</h2>
            <MapaDistritos
              valores={raza.valores}
              unidad={raza.unidad}
              seleccionado={distrito}
              onSeleccionar={setDistrito}
            />
          </div>
          <RankingDistritos
            titulo="Los 10 distritos con más empleos de personas pretas o pardas"
            ranking={raza.ranking}
            unidad={raza.unidad}
            seleccionado={distrito}
            onSeleccionar={setDistrito}
          />
        </div>
      </SeccionCapitulo>

      <NotaMetodo titulo="Los grupos">
        {cortes
          ? `«Con más favelas» son los distritos donde al menos el ${formatear(cortes.corte_mas_favelas_pct)} % de los domicilios está en una favela; «con menos», donde lo está como mucho el ${formatear(cortes.corte_menos_favelas_pct)} %. `
          : ""}
        Cada tasa se calcula sumando el grupo (por ejemplo, toda su población cerca del metro sobre toda su población),
        no promediando distritos.
      </NotaMetodo>
      <NotaMetodo titulo="Escuelas">
        El lago tiene solo las escuelas públicas. En los distritos de ingresos altos muchas familias usan escuelas
        privadas, así que una tasa más baja de escuelas públicas ahí no significa menos escuelas en total.
      </NotaMetodo>
      <NotaMetodo titulo="Empleo por raza o color">
        Es un dato Sensible: se publica solo como porcentaje, y una categoría con menos de 10 empleos no se muestra. La
        RAIS cuenta el empleo donde está la empresa, no donde vive quien trabaja. En 2023 el 10,8 % de los empleos no
        tenía raza o color registrada; en 2024, el 2,4 %.
      </NotaMetodo>
    </section>
  );
}
