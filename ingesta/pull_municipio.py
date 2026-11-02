"""Municipio: F03 establecimientos de salud por red y F04 finanzas (ingresos y gastos).

Son fuentes del municipio en conjunto: no se abren por distrito (la sección «Municipio» del sitio).

Salidas:
  data/lago/salud_establecimientos.csv, una fila por red y tipo de servicio:
    red, tipo_servicio, establecimientos.
  data/lago/finanzas_municipio.csv, una fila por año, tipo y concepto:
    anio, tipo, concepto, valor_rs.

Ambas tablas de Infocidade traen filas de total (el «995» de salud, los subtotales por bloque de
finanzas): se quitan para no contar dos veces. Los parsers fallan ruidosamente si la estructura de
la fuente cambia, en vez de producir cifras mal leídas.
"""

import re

import pandas as pd

from comun import (
    a_numero,
    descargar,
    es_vacio,
    guardar_lago,
    leer_excel,
    limpiar_anio,
    limpiar_espacios,
)

URL_F03 = (
    "https://prefeitura.sp.gov.br/documents/d/licenciamento/tabela-estabelecimentos-e-servicos-de-saude-por-rede-2025"
)
URL_F04 = (
    "https://prefeitura.sp.gov.br/documents/d/licenciamento/1_receita_segundo_fontes_e_despesas_por_categoria_2025-1-"
)

# Las redes son los títulos de bloque de la tabla de salud (una red, debajo sus tipos de servicio).
# El texto de la fuente trae «Rede Municipal», «Rede Estadual», etc.; se guarda la palabra clave.
REDES = {
    "rede municipal": "Municipal",
    "municipal": "Municipal",
    "rede estadual": "Estadual",
    "estadual": "Estadual",
    "rede federal": "Federal",
    "federal": "Federal",
    "rede privada": "Privada",
    "privada": "Privada",
}
# Palabras que marcan una fila de total o subtotal, que no se guarda (evita doble conteo).
TOTALES = ("total", "subtotal")

# Año del censo de salud que publica la fuente (y que registra el Diccionario).
ANIO_SALUD = 2025

# F04: los dos bloques de la primera columna.
BLOQUES_F04 = {
    "receita": "Receita",
    "receitas": "Receita",
    "despesa": "Despesa",
    "despesas": "Despesa",
}


def _clave(texto) -> str:
    return limpiar_espacios(str(texto)).lower()


def _hoja_salud(ruta) -> tuple[pd.DataFrame, int]:
    """Elige la hoja con una sola columna de cifras (nombre, conteo) y el año de su título.

    El archivo trae varias hojas; algunas comparan dos años en columnas aparte. Se usa la hoja cuya
    columna 1 es la única con cifras (las demás de comparación vienen vacías) y el año más reciente.
    """
    hojas = leer_excel(ruta, sheet_name=None)
    mejor = None
    for df in hojas.values():
        if df.shape[1] < 2 or len(df) < 6:
            continue
        # Año del título: está en las primeras filas de la primera columna (p. ej. «2025»).
        anios_titulo = [
            limpiar_anio(v) for v in df.iloc[:4, 0].tolist() if re.fullmatch(r"\s*20\d{2}\s*", str(v or ""))
        ]
        if not anios_titulo:
            continue
        anio = max(anios_titulo)
        # Cuántas filas de red hay con cifra en la columna 1: la hoja buena las tiene todas.
        redes = df[df[0].map(_clave).isin(REDES)]
        con_cifra = sum(not es_vacio(c) for c in redes[1]) if not redes.empty else 0
        puntaje = (anio, con_cifra, -df.shape[1])  # año reciente, con cifras, y lo más angosta posible
        if mejor is None or puntaje > mejor[0]:
            mejor = (puntaje, df, anio)
    if mejor is None:
        raise ValueError("F03: no se encontró ninguna hoja con redes y un año en el título")
    return mejor[1], mejor[2]


def salud() -> pd.DataFrame:
    """F03: establecimientos de salud por red y tipo de servicio, del último año de la fuente.

    La fuente pone cada red como título de bloque (con su subtotal al lado) y, debajo, una fila por
    tipo de servicio con su conteo. Se arrastra la red a cada tipo y se descartan la fila del total
    del municipio (MSP) y los subtotales de red, para no contar dos veces.
    """
    ruta = descargar(URL_F03, "f03_salud_por_red", "xls")
    crudo, anio = _hoja_salud(ruta)
    # Columnas útiles: 0 = nombre (tipo o título de red), 1 = conteo.
    cuerpo = crudo.iloc[:, :2].copy()
    cuerpo.columns = ["nombre", "conteo"]
    cuerpo["nombre"] = cuerpo["nombre"].map(lambda v: limpiar_espacios(str(v)) if not es_vacio(v) else "")

    filas = []
    red_actual = None
    for nombre, conteo in zip(cuerpo["nombre"], cuerpo["conteo"], strict=True):
        clave = nombre.lower()
        if not nombre:
            continue
        if clave in REDES:
            # Título de bloque: fija la red. El número de su fila es el subtotal, no se guarda.
            red_actual = REDES[clave]
            continue
        if (
            clave in ("msp", "pmsp", "ano")
            or clave.startswith(("fonte", "elabora"))
            or any(t in clave for t in TOTALES)
        ):
            continue
        if es_vacio(conteo):
            # Tipo sin cifra en esta hoja (viene en otra columna de comparación): no es un dato de aquí.
            continue
        if red_actual is None:
            # Antes de la primera red (título, MSP…): no es un tipo de servicio.
            continue
        filas.append((red_actual, nombre.upper(), int(a_numero(conteo))))

    df = pd.DataFrame(filas, columns=["red", "tipo_servicio", "establecimientos"])
    if df.empty:
        raise ValueError("F03: no se leyó ningún establecimiento; revisa la estructura de la fuente")
    df = df[df["establecimientos"] > 0]
    df = df.groupby(["red", "tipo_servicio"], as_index=False)["establecimientos"].sum()
    # Se comprueba que el año elegido sea el que el Diccionario espera (2025), por si la fuente cambia.
    if anio != ANIO_SALUD:
        raise ValueError(f"F03: la hoja más reciente es de {anio}, pero el Diccionario espera {ANIO_SALUD}")
    return df.sort_values(["red", "tipo_servicio"]).reset_index(drop=True)


def _anios_en_encabezado(fila) -> dict[int, int]:
    """Columnas cuyo encabezado es un año → {columna: año}. F04 trae 2016 … 2025 como columnas."""
    anios = {}
    for col, valor in enumerate(fila):
        texto = "" if es_vacio(valor) else str(valor)
        m = re.fullmatch(r"\s*(20\d{2})(?:[\s·.²¹]*)?", texto)
        if m:
            anios[col] = int(m.group(1))
    return anios


def finanzas() -> pd.DataFrame:
    """F04: ingresos por fuente y gastos por categoría del municipio, 2016-2025.

    La fuente tiene dos bloques («Receitas», «Despesas»); dentro, una fila por concepto y una columna
    por año. Se pasa de ancho a largo y se quitan las filas de total de cada bloque.
    """
    ruta = descargar(URL_F04, "f04_receita_despesa", "xls")
    crudo = leer_excel(ruta)
    # El encabezado de años es la primera fila con varias columnas de año.
    fila_enc = None
    anios = {}
    for i in range(min(15, len(crudo))):
        candidato = _anios_en_encabezado(crudo.iloc[i])
        if len(candidato) >= 3:
            fila_enc, anios = i, candidato
            break
    if fila_enc is None:
        raise ValueError("F04: no se encontró la fila de encabezado con los años (2016 … 2025)")

    cuerpo = crudo.iloc[fila_enc + 1 :]
    filas = []
    tipo_actual = None
    for _, fila in cuerpo.iterrows():
        etiqueta = "" if es_vacio(fila[0]) else limpiar_espacios(str(fila[0]))
        clave = etiqueta.lower()
        if not etiqueta:
            continue
        # Título de bloque: «Receitas» / «Despesas» (sin cifras).
        sin_cifras = all(es_vacio(fila[c]) for c in anios)
        bloque = next((BLOQUES_F04[b] for b in BLOQUES_F04 if clave.startswith(b)), None)
        if bloque and sin_cifras:
            tipo_actual = bloque
            continue
        if any(t in clave for t in TOTALES):
            continue
        if sin_cifras:
            continue
        if tipo_actual is None:
            raise ValueError(f"F04: el concepto {etiqueta!r} aparece antes de «Receitas» o «Despesas»")
        for col, anio in anios.items():
            valor = a_numero(fila[col])  # «1.234.567,89» → 1234567.89; «-» → None
            filas.append((anio, tipo_actual, etiqueta, valor))

    df = pd.DataFrame(filas, columns=["anio", "tipo", "concepto", "valor_rs"])
    if df.empty:
        raise ValueError("F04: no se leyó ningún valor; revisa la estructura de la fuente")
    df["anio"] = df["anio"].astype(int)
    df["valor_rs"] = pd.to_numeric(df["valor_rs"], errors="coerce").astype("Float64")
    return df.sort_values(["tipo", "concepto", "anio"]).reset_index(drop=True)


def main():
    guardar_lago(salud(), "salud_establecimientos.csv")
    guardar_lago(finanzas(), "finanzas_municipio.csv")


if __name__ == "__main__":
    main()
