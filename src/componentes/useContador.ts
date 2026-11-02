import { useEffect, useRef, useState } from "react";

const DURACION_MS = 900;

// Desacelera al final, como los contadores de las placas de Apple.
const suavizar = (t: number) => 1 - (1 - t) ** 4;

/**
 * La cifra animada desde el valor anterior hasta el nuevo (la primera vez, desde 0). Con «reducir
 * movimiento» activado devuelve el valor tal cual. Los null pasan sin animar.
 */
export function useContador(valor: number | null): number | null {
  const [mostrado, setMostrado] = useState<number | null>(valor === null ? null : 0);
  const anterior = useRef(0);

  useEffect(() => {
    if (valor === null) {
      setMostrado(null);
      return;
    }
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desde = anterior.current;
    anterior.current = valor;
    if (reducir || desde === valor) {
      setMostrado(valor);
      return;
    }
    let cuadro = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      setMostrado(t === 1 ? valor : desde + (valor - desde) * suavizar(t));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);

  return mostrado;
}
