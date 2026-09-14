/**
 * El contrato del texto de la landing.
 *
 * Es una interfaz **escrita a mano** y no un `typeof es`, a propósito. Derivarla del castellano haría
 * que el castellano nunca pudiera "faltarle" una clave: el tipo diría que sí a cualquier cosa que el
 * fichero de referencia contenga, y el único idioma vigilado sería el otro. Escrita aparte, los dos
 * idiomas se miden contra lo mismo y a los dos les puede faltar algo.
 *
 * Por qué importa aquí más que en una web cualquiera: en esta página **cada afirmación es un
 * compromiso** — «no tocamos tus credenciales», «no hay piloto todavía». Si una versión dice algo que
 * la otra no, no es una traducción incompleta: es que una de las dos miente. Un `Record<string,
 * string>` con claves opcionales lo permitiría en silencio; esto no compila.
 */

/** Un paso del «cómo funciona»: el ordinal lo pone el marcado, no el texto. */
export interface Paso {
  /** La frase en negrita que abre el paso. */
  readonly titulo: string;
  /** El resto, en texto normal. */
  readonly cuerpo: string;
}

/** Una de las cuatro cosas que Relevo **no** hace. */
export interface NoEs {
  readonly titulo: string;
  readonly cuerpo: string;
}

/** Un tope, con su cifra y su unidad. La cifra es un límite, nunca una métrica de actividad. */
export interface Tope {
  /** Se renderiza tal cual. Va como cadena porque «10» y «1» son texto tipográfico, no aritmética. */
  readonly cifra: string;
  readonly etiqueta: string;
}

/** Una fila de la ficha de cada vía: etiqueta corta en mono + su explicación. */
export interface Fila {
  readonly etiqueta: string;
  readonly texto: string;
}

/** El correo que se abre al pulsar la llamada a la acción de una vía. */
export interface Correo {
  readonly asunto: string;
  /** Una entrada por línea. El `\n` lo pone el constructor, no el diccionario. */
  readonly cuerpo: readonly string[];
}

/** Una de las dos vías: la organización y el proyecto open source. */
export interface Via {
  /** Texto del botón de la bifurcación. */
  readonly boton: string;
  readonly titulo: string;
  /** Párrafo de entrada; sólo la vía OSS lo necesita, así que puede faltar. */
  readonly intro?: string;
  readonly filas: readonly Fila[];
  /** Bloque monoespaciado que alguien copia a su repositorio. Sólo la vía OSS. */
  readonly bloqueCodigo?: readonly string[];
  readonly cta: string;
  /** «o copia», antes de la dirección en texto plano. */
  readonly copiaAntes: string;
  readonly correo: Correo;
}

export interface Copy {
  readonly meta: {
    /** Código BCP-47 que va en `<html lang>`. */
    readonly lang: string;
    readonly titulo: string;
    readonly descripcion: string;
    /** Nombre del OTRO idioma, en el otro idioma (`English`, `Español`). */
    readonly otroIdioma: string;
    /** Texto accesible del enlace de cambio de idioma. */
    readonly otroIdiomaAria: string;
    readonly saltarAlContenido: string;
  };
  readonly cabecera: {
    readonly licencia: string;
    readonly lede: string;
    readonly entradilla: string;
  };
  readonly queEs: {
    readonly etiqueta: string;
    readonly titulo: string;
    readonly intro: string;
    readonly pasos: readonly Paso[];
  };
  readonly queNoEs: {
    readonly etiqueta: string;
    readonly titulo: string;
    readonly puntos: readonly NoEs[];
  };
  readonly limites: {
    readonly etiqueta: string;
    readonly titulo: string;
    readonly topes: readonly Tope[];
    readonly parrafos: readonly string[];
  };
  readonly bifurcacion: {
    readonly etiqueta: string;
    readonly titulo: string;
    readonly intro: string;
    /**
     * Aviso de que la dirección de contacto es todavía un marcador y las dos llamadas a la acción no
     * llevan a ninguna parte. Se renderiza SÓLO mientras `CORREO_ES_MARCADOR` sea cierto.
     *
     * Es obligatorio en el tipo, no opcional: el día que se ponga la dirección real habrá que borrar
     * el aviso de los dos idiomas a la vez, y un campo opcional permite quitarlo de uno y olvidar el
     * otro. En esta página eso no es una traducción a medias, es una de las dos versiones mintiendo.
     */
    readonly avisoCorreo: string;
    readonly ong: Via;
    readonly oss: Via;
  };
  readonly estado: {
    readonly etiqueta: string;
    readonly titulo: string;
    readonly parrafos: readonly string[];
  };
  readonly pie: {
    readonly licencia: string;
    readonly repo: string;
  };
}
