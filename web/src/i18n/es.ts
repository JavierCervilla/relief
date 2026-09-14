import type { Copy } from "./types.js";

/**
 * El texto en castellano.
 *
 * Lo que NO puede aparecer aquí, y está comprobado por test sobre el HTML renderizado:
 *   - nombres de organizaciones reales (son fixtures del repo, no socios);
 *   - cifras de actividad (no hay ni una tarea completada; un número sería falso).
 * Los únicos números permitidos son los TOPES y el dato citado del estudio de 2026.
 */
export const es: Copy = {
  meta: {
    lang: "es",
    titulo: "Relevo — voluntariado asistido por IA, con una persona al mando",
    descripcion:
      "Eliges una tarea de una organización que pidió ayuda, la haces en tu propia sesión de Claude Code, la revisas y la envías. Relevo no toca tus credenciales y no abre pull requests.",
    otroIdioma: "English",
    otroIdiomaAria: "Read this page in English",
    saltarAlContenido: "Saltar al contenido",
  },

  cabecera: {
    licencia: "AGPL-3.0",
    lede: "Un rato tuyo, una tarea menos para quien no llega.",
    entradilla:
      "Eliges una tarea de una organización que pidió ayuda, la haces en tu propia sesión de Claude Code, la revisas y la envías. Nada más.",
  },

  queEs: {
    etiqueta: "Qué es",
    titulo: "Voluntariado, con la IA de herramienta y una persona al mando",
    intro:
      "Hay organizaciones con trabajo útil parado por falta de manos: traducciones que nadie revisa, documentos que nadie adapta a lectura fácil, estudios que nadie clasifica. Y hay gente con una suscripción a Claude que no agota nunca.",
    pasos: [
      {
        titulo: "Eliges la tarea.",
        cuerpo:
          "Ves quién la publica, con qué permiso lo hace y cuánto se estima que lleva. Si no te convence, no la coges.",
      },
      {
        titulo: "La haces en tu sesión.",
        cuerpo:
          "Relevo te entrega el material y las instrucciones. El modelo es el tuyo, la máquina es la tuya, la cuenta es la tuya.",
      },
      {
        titulo: "La revisas y la firmas.",
        cuerpo:
          "Confirmas que la has leído entera. Sin esa confirmación el trabajo no sale de tu ordenador.",
      },
    ],
  },

  queNoEs: {
    etiqueta: "Qué no es",
    titulo: "Lo que Relevo no hace. Y no es una promesa: es que no puede",
    puntos: [
      {
        titulo: "No toca tus credenciales.",
        cuerpo:
          "No es un proxy de inferencia. No reenvía tu suscripción, no ejecuta nada en tu nombre y no tiene ninguna clave tuya. El trabajo ocurre en tu sesión o no ocurre.",
      },
      {
        titulo: "No hay nada automático.",
        cuerpo:
          "Cada tarea la elige, la ejecuta y la revisa una persona. No hay cola que se vacíe sola ni lote que se procese de noche.",
      },
      {
        titulo: "No abre pull requests.",
        cuerpo:
          "Relevo no tiene cuenta en tu forja ni permiso de escritura en tu repositorio. Si algo llega, te lo manda una persona, con su nombre y su firma.",
      },
      {
        titulo: "No nombra a nadie sin permiso.",
        cuerpo:
          "Ninguna organización aparece en esta página hasta que lo ha autorizado por escrito. Empezando por el hecho de que, hoy, no hay ninguna.",
      },
    ],
  },

  limites: {
    etiqueta: "Los límites",
    titulo: "Los topes no son una tarifa. Son el freno.",
    topes: [
      { cifra: "3", etiqueta: "Tareas por sesión" },
      { cifra: "10", etiqueta: "Tareas al día" },
      { cifra: "1", etiqueta: "Parche de código / sesión" },
    ],
    parrafos: [
      "En 2026 un estudio sobre 294 repositorios y más de dos millones de pull requests midió lo que los mantenedores llaman AI-DDoS: contribuciones plausibles que llegan más deprisa de lo que nadie puede revisarlas. El 67 % de 800 mantenedores encuestados lo describe como una carga significativa. Como lo resumió uno: «diez pull requests en el tiempo que cuesta verificar uno».",
      "Una cola que reparta trabajo sobre el backlog de otra persona sin freno es esa máquina. Por eso los topes no se amplían pagando y por eso el permiso no vive en una política que se pueda relajar: vive en el contrato de datos. Una tarea sin permiso no está prohibida — es imposible de construir.",
    ],
  },

  bifurcacion: {
    etiqueta: "Escríbenos",
    titulo: "¿Desde dónde escribes?",
    intro:
      "Lo que necesitamos de una organización y lo que necesitamos de un proyecto de software no se parecen en nada. Elige y te cuento sólo lo tuyo.",
    avisoCorreo:
      "Ojo: esta dirección es todavía un marcador y el correo no llegará a ninguna parte. La web está publicada antes que el buzón, y prefiero decirlo a que escribas al vacío.",

    ong: {
      boton: "Represento a una organización",
      titulo: "Para una organización",
      filas: [
        {
          etiqueta: "Qué encaja",
          texto:
            "Traducir y revisar traducciones. Adaptar documentos a lectura fácil. Clasificar y etiquetar material contra un criterio que nos deis vosotros.",
        },
        {
          etiqueta: "Qué hace falta",
          texto:
            "Un permiso por escrito — un correo basta para empezar — y un puñado de ejemplos reales del trabajo que os sobra.",
        },
        {
          etiqueta: "Qué no hace falta",
          texto: "Acceso a vuestros sistemas. Datos personales de nadie. Presupuesto.",
        },
      ],
      cta: "Escribir con el asunto ya puesto",
      copiaAntes: "o copia",
      correo: {
        asunto: "Relevo — organización interesada",
        cuerpo: [
          "Hola,",
          "",
          "Organización:",
          "A qué nos dedicamos:",
          "Qué trabajo nos sobra (traducción / lectura fácil / clasificación):",
          "Podemos mandar ejemplos reales: sí / no",
          "",
          "Quién firma el permiso por escrito:",
        ],
      },
    },

    oss: {
      boton: "Mantengo un proyecto open source",
      titulo: "Para un proyecto open source",
      intro:
        "Nada sale de tu repositorio sin dos permisos tuyos, y los dos los escribes tú, en tu repositorio, donde puedes retirarlos cuando quieras.",
      filas: [
        {
          etiqueta: "Permiso 1",
          texto:
            "Una URL pública en tu repo que dice que Relevo puede sacar tareas de este proyecto. Sin ella no existe ninguna tarea tuya — y la comprobación no es un aviso que alguien pueda ignorar: la tarea no se puede ni construir.",
        },
        {
          etiqueta: "Permiso 2",
          texto:
            "Para código, además: la issue concreta tiene que estar marcada por ti como abierta a ayuda de IA. Sin issue marcada no hay parche, y sólo uno por sesión.",
        },
        {
          etiqueta: "Quién te llega",
          texto:
            "Una persona que ha leído el diff entero y firma que lo ha hecho. No un bot con tu etiqueta.",
        },
        {
          etiqueta: "Cómo se corta",
          texto:
            "Borras la URL del opt-in. No hay que avisarnos, ni esperar a que lo aprobemos, ni entrar en ningún panel.",
        },
      ],
      bloqueCodigo: [
        "# AI-CONTRIBUTIONS.md",
        "Este proyecto acepta tareas vía Relevo.",
        "Sólo las issues con la etiqueta `ai-assisted-ok`.",
        "Autoriza: @tu-usuario",
      ],
      cta: "Escribir con el asunto ya puesto",
      copiaAntes: "o copia",
      correo: {
        asunto: "Relevo — proyecto open source interesado",
        cuerpo: [
          "Hola,",
          "",
          "Proyecto:",
          "Repositorio:",
          "Soy mantenedor/a con permiso para autorizar esto: sí / no",
          "Qué tipo de tarea encaja (documentación / traducción / issues concretas):",
          "",
          "Dudas o condiciones antes de publicar el opt-in:",
        ],
      },
    },
  },

  estado: {
    etiqueta: "Dónde estamos",
    titulo: "No hay piloto todavía. Estás leyendo el principio.",
    parrafos: [
      "No hay voluntarios activos, ni tareas completadas, ni ninguna organización a bordo. Lo que hay es el software escrito, las reglas decididas y esta página buscando a los primeros. Prefiero decirlo aquí que dejar que lo descubras luego.",
      "Contesta una persona, normalmente en un par de días. Si lo que has leído no te encaja, decírmelo también me sirve — y bastante.",
    ],
  },

  pie: {
    licencia: "Relevo es software libre, AGPL-3.0.",
    repo: "Código y decisiones en GitHub",
  },
};
