import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import type { Indicador } from "../datos";
import { useFuentes } from "./contexto";

// Las tarjetas muestran solo la cifra. Su fuente, vigencia, tipo, cálculo y advertencia van al bloque
// «Fuentes y notas» del final de la sección, numerados: la tarjeta lleva el número de su nota. Así cada cifra
// sigue diciendo de dónde sale (contrato del plan), sin cargar la tarjeta.

export const ETIQUETA_TIPO: Record<Indicador["tipo"], string> = {
  observado: "Observado",
  estimado: "Estimado",
  proxy: "Proxy",
  declarado: "Declarado",
};

interface NotaTarjeta {
  tipo: "tarjeta";
  titulo: string;
  indicador?: Indicador;
}

interface NotaMetodoRegistrada {
  tipo: "metodo";
  titulo: string;
  texto: ReactNode;
}

type Nota = NotaTarjeta | NotaMetodoRegistrada;

interface Registro {
  notas: [string, Nota][];
  registrar: (id: string, nota: Nota) => void;
  quitar: (id: string) => void;
}

const NotasContexto = createContext<Registro | null>(null);

/** Una sección entera: guarda las notas en el orden en que aparecen sus tarjetas. */
export function NotasProveedor({ children }: { children: ReactNode }) {
  const [notas, setNotas] = useState<[string, Nota][]>([]);
  const registrar = useCallback((id: string, nota: Nota) => {
    setNotas((actuales) => {
      const i = actuales.findIndex(([clave]) => clave === id);
      if (i === -1) return [...actuales, [id, nota]];
      const copia = [...actuales];
      copia[i] = [id, nota];
      return copia;
    });
  }, []);
  const quitar = useCallback((id: string) => setNotas((actuales) => actuales.filter(([clave]) => clave !== id)), []);
  const valor = useMemo(() => ({ notas, registrar, quitar }), [notas, registrar, quitar]);
  return <NotasContexto.Provider value={valor}>{children}</NotasContexto.Provider>;
}

const idNota = (n: number) => `nota-${n}`;

/**
 * Registra una nota mientras el componente está montado. El lugar en la lista se fija al montar, para que el
 * orden siga al de la página; después solo se actualiza su contenido.
 */
function useRegistro(nota: Nota): [Registro | null, string] {
  const registro = useContext(NotasContexto);
  const id = useId();
  const { registrar, quitar } = registro ?? {};
  useEffect(() => () => quitar?.(id), [id, quitar]);
  useEffect(() => {
    registrar?.(id, nota);
  }, [id, registrar, nota]);
  return [registro, id];
}

/** Registra la nota de una tarjeta y devuelve su número (undefined mientras no hay dato). */
export function useNotaTarjeta(titulo: string, indicador?: Indicador): number | undefined {
  const nota = useMemo<Nota>(() => ({ tipo: "tarjeta", titulo, indicador }), [titulo, indicador]);
  const [registro, id] = useRegistro(nota);
  if (!registro || !indicador) return undefined;
  const conDato = registro.notas.filter(([, n]) => n.tipo === "tarjeta" && n.indicador);
  const i = conDato.findIndex(([clave]) => clave === id);
  return i === -1 ? undefined : i + 1;
}

/** Botón con el número de nota de una tarjeta: lleva a su nota al final de la sección. */
export function ReferenciaNota({ numero }: { numero?: number }) {
  if (numero === undefined) return null;
  const ir = () => {
    const destino = document.getElementById(idNota(numero));
    if (!destino) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    destino.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
    destino.focus({ preventScroll: true });
  };
  return (
    <button type="button" className="ref-nota" onClick={ir} aria-label={`Ver la fuente y las notas (nota ${numero})`}>
      {numero}
    </button>
  );
}

/** Una nota de método de la sección (comparaciones entre años, cómo se reparte algo…). No pinta nada aquí. */
export function NotaMetodo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const nota = useMemo<Nota>(() => ({ tipo: "metodo", titulo, texto: children }), [titulo, children]);
  useRegistro(nota);
  return null;
}

/**
 * El bloque del final de la sección: notas de método, las de cada tarjeta (numeradas) y las fuentes de la sección
 * con su fecha de prueba, que cubren también las cifras de mapas y gráficos.
 */
export function NotasSeccion({ fuentesSeccion = [] }: { fuentesSeccion?: string[] }) {
  const registro = useContext(NotasContexto);
  const fuentes = useFuentes();
  if (!registro) return null;
  const metodos = registro.notas.flatMap(([, n]) => (n.tipo === "metodo" ? [n] : []));
  const tarjetas = registro.notas.flatMap(([id, n]) => (n.tipo === "tarjeta" && n.indicador ? [{ id, ...n }] : []));
  const deLaSeccion = fuentesSeccion.flatMap((id) => (fuentes[id] ? [fuentes[id]] : []));
  if (!metodos.length && !tarjetas.length && !deLaSeccion.length) return null;

  return (
    <section className="notas-seccion" aria-labelledby="notas-titulo">
      <h2 id="notas-titulo">Fuentes y notas</h2>
      {metodos.length > 0 && (
        <div className="notas-metodo">
          {metodos.map((m) => (
            <p key={m.titulo}>
              <strong>{m.titulo}.</strong> {m.texto}
            </p>
          ))}
        </div>
      )}
      {tarjetas.length > 0 && (
        <ol className="notas-lista">
          {tarjetas.map((n, i) => {
            const ind = n.indicador as Indicador;
            const fuente = fuentes[ind.fuente_id];
            return (
              <li key={n.id} id={idNota(i + 1)} tabIndex={-1}>
                <span className="notas-numero">{i + 1}</span>
                <div>
                  <p className="notas-cabeza">
                    <strong>{n.titulo}</strong> · {ind.fuente_id}
                    {fuente ? ` (${fuente.entidad})` : ""}
                    {ind.fuentes_adicionales?.length ? ` + ${ind.fuentes_adicionales.join(", ")}` : ""} · vigencia{" "}
                    {ind.vigencia} · {ETIQUETA_TIPO[ind.tipo].toLowerCase()}
                    {fuente?.fecha_prueba ? ` · probada el ${fuente.fecha_prueba}` : ""}
                  </p>
                  {ind.calculo && <p>Cálculo: {ind.calculo}.</p>}
                  {ind.advertencia && <p>{ind.advertencia}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {deLaSeccion.length > 0 && (
        <>
          <h3>Fuentes de esta sección</h3>
          <ul className="notas-fuentes">
            {deLaSeccion.map((f) => (
              <li key={f.fuente_id}>
                <strong>{f.fuente_id}</strong> · {f.nombre} ({f.entidad}) · periodo {f.periodo} · probada el{" "}
                {f.fecha_prueba}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
