import { useEffect } from "react";

// Lo que aparece al entrar en pantalla. Los paneles se cargan después (datos, secciones diferidas), así que
// un MutationObserver vigila los que se van agregando.
const SELECTOR = [
  ".capitulo > .panel",
  ".capitulo > .rejilla-dos",
  ".capitulo > .rejilla-tarjetas > .tarjeta",
  ".seccion > .rejilla-tarjetas > .tarjeta",
  ".panel-red",
  ".lista-vacios > div",
].join(",");

/**
 * Marca con «visto» cada elemento de SELECTOR cuando entra en pantalla; estilos.css lo anima. Solo se
 * esconde lo que este hook ya vigila (clase «por-revelar»), así que sin JavaScript o con «reducir
 * movimiento» todo se ve desde el principio.
 */
export function useRevelar() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const visor = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("visto");
          visor.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const vigilar = () => {
      for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (el.classList.contains("por-revelar")) continue;
        // Lo que ya está en pantalla al cargar no se esconde: solo lo que está más abajo.
        if (el.getBoundingClientRect().top < window.innerHeight) continue;
        el.classList.add("por-revelar");
        visor.observe(el);
      }
    };
    vigilar();
    const mutaciones = new MutationObserver(vigilar);
    const raiz = document.getElementById("contenido");
    if (raiz) mutaciones.observe(raiz, { childList: true, subtree: true });
    return () => {
      visor.disconnect();
      mutaciones.disconnect();
    };
  }, []);
}
