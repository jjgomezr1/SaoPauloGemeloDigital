import { formatear, type Indicador } from "../datos";
import { ETIQUETA_TIPO, ReferenciaNota, useNotaTarjeta } from "./notas";
import { useContador } from "./useContador";

/** «Paradas» sale en minúscula junto a la cifra; los grados («°C») se dejan como vienen. */
function unidadVisible(unidad: string): string {
  return unidad.startsWith("°") ? unidad : unidad.toLowerCase();
}

interface Props {
  titulo: string;
  indicador?: Indicador;
  destacado?: boolean;
}

/**
 * La tarjeta muestra la cifra, su unidad y su territorio. La fuente, la vigencia, el tipo, el cálculo y la
 * advertencia van al bloque «Fuentes y notas» del final de la sección (notas.tsx), con el número de la tarjeta.
 */
export default function TarjetaIndicador({ titulo, indicador, destacado }: Props) {
  const animado = useContador(indicador?.valor ?? null);
  const numero = useNotaTarjeta(titulo, indicador);
  if (!indicador) {
    return (
      <article className="tarjeta cargando" aria-busy>
        <h3>{titulo}</h3>
        <p className="cifra">…</p>
      </article>
    );
  }
  return (
    <article className={destacado ? "tarjeta tarjeta-destacada" : "tarjeta"}>
      <h3>
        {titulo}
        <ReferenciaNota numero={numero} />
      </h3>
      <p className={destacado ? "cifra cifra-destacada" : "cifra"}>
        {/* La cifra animada se oculta a los lectores de pantalla, que leen solo la final. */}
        <span aria-hidden>{formatear(animado, indicador.unidad)}</span>
        <span className="solo-lector">{formatear(indicador.valor, indicador.unidad)}</span>
        {!indicador.unidad.startsWith("%") && <span className="unidad"> {unidadVisible(indicador.unidad)}</span>}
      </p>
      <p className="territorio">
        {indicador.nombre_territorio}
        {/* Lo que no es una medición directa (estimado, proxy, declarado) se marca en la tarjeta. */}
        {indicador.tipo !== "observado" && (
          <span className={`etiqueta-tipo tipo-${indicador.tipo}`}>{ETIQUETA_TIPO[indicador.tipo]}</span>
        )}
      </p>
    </article>
  );
}
