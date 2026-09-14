import type { Copy } from "./types.js";

/**
 * The English copy.
 *
 * Not a literal translation of `es.ts` — the same **commitments**, said the way they would be said in
 * English. Every claim on this page is a promise, so the two versions have to bind us to the same
 * things; where the Spanish leans on a turn of phrase, the English gets its own, and where it makes a
 * factual claim, the English makes exactly that claim and no larger one.
 *
 * The same two bans apply, and are checked against the rendered HTML of THIS locale too:
 * no organisation names, no activity figures.
 */
export const en: Copy = {
  meta: {
    lang: "en",
    titulo: "Relevo — AI-assisted volunteering, with a person in charge",
    descripcion:
      "You pick a task from an organisation that asked for help, do it in your own Claude Code session, review it and send it. Relevo never touches your credentials and never opens pull requests.",
    otroIdioma: "Español",
    otroIdiomaAria: "Leer esta página en español",
    saltarAlContenido: "Skip to content",
  },

  cabecera: {
    licencia: "AGPL-3.0",
    lede: "An hour of yours, one task less for someone who can't keep up.",
    entradilla:
      "You pick a task from an organisation that asked for help, do it in your own Claude Code session, review it and send it. That's the whole thing.",
  },

  queEs: {
    etiqueta: "What it is",
    titulo: "Volunteering, with AI as the tool and a person in charge",
    intro:
      "There are organisations with useful work stalled for lack of hands: translations nobody reviews, documents nobody adapts to plain language, studies nobody classifies. And there are people with a Claude subscription they never come close to using up.",
    pasos: [
      {
        titulo: "You pick the task.",
        cuerpo:
          "You see who published it, under what permission, and roughly how long it should take. If it doesn't convince you, you don't take it.",
      },
      {
        titulo: "You do it in your session.",
        cuerpo:
          "Relevo hands you the material and the instructions. The model is yours, the machine is yours, the account is yours.",
      },
      {
        titulo: "You review it and you sign it.",
        cuerpo:
          "You confirm you have read the whole thing. Without that confirmation the work never leaves your computer.",
      },
    ],
  },

  queNoEs: {
    etiqueta: "What it isn't",
    titulo: "What Relevo doesn't do. And it isn't a promise: it's that it can't",
    puntos: [
      {
        titulo: "It never touches your credentials.",
        cuerpo:
          "It is not an inference proxy. It doesn't relay your subscription, doesn't run anything on your behalf, and holds no key of yours. The work happens in your session or it doesn't happen.",
      },
      {
        titulo: "Nothing is automatic.",
        cuerpo:
          "Every task is chosen, run and reviewed by a person. There is no queue that drains itself and no batch that runs overnight.",
      },
      {
        titulo: "It doesn't open pull requests.",
        cuerpo:
          "Relevo has no account on your forge and no write access to your repository. If something reaches you, a person sent it, under their own name and their own signature.",
      },
      {
        titulo: "It names no participant without permission.",
        cuerpo:
          "No charity or project appears here as a participant until it authorises that in writing — starting with the fact that, today, there is none. Claude Code and GitHub are named, because without saying which tool the volunteer uses and where the code lives none of this makes sense: they have authorised nothing, they take no part, and they have no relationship with Relevo.",
      },
    ],
  },

  limites: {
    etiqueta: "The limits",
    titulo: "The caps aren't a pricing tier. They're the brake.",
    topes: [
      { cifra: "3", etiqueta: "Tasks per session" },
      { cifra: "10", etiqueta: "Tasks per day" },
      { cifra: "1", etiqueta: "Code patch / session" },
    ],
    parrafos: [
      "In 2026 a study across 294 repositories and more than two million pull requests measured what maintainers call AI-DDoS: plausible contributions arriving faster than anyone can review them. 67 % of 800 maintainers surveyed describe it as a significant burden. As one of them put it: «ten pull requests in the time it takes to verify one».",
      "A queue that hands out work against someone else's backlog with no brake is that machine. That is why the caps can't be raised by paying, and why permission doesn't live in a policy someone can relax: it lives in the data contract. A task without permission isn't forbidden — it's impossible to construct.",
    ],
  },

  bifurcacion: {
    etiqueta: "Get in touch",
    titulo: "Where are you writing from?",
    intro:
      "What we need from an organisation and what we need from a software project have nothing in common. Pick one and I'll only tell you your half.",
    avisoCorreo:
      "Heads-up: this address is still a placeholder and mail sent to it will go nowhere. The site is up before the mailbox is, and I would rather say so than have you write into the void. Meanwhile the only channel you can verify yourself is the repository linked below: if someone writes to you saying the official address isn't live yet and to reply somewhere else, that isn't us.",

    ong: {
      boton: "I represent an organisation",
      titulo: "For an organisation",
      filas: [
        {
          etiqueta: "What fits",
          texto:
            "Translating and reviewing translations. Adapting documents to plain language. Classifying and labelling material against criteria you give us.",
        },
        {
          etiqueta: "What we need",
          texto:
            "Permission in writing — an email is enough to start — and a handful of real examples of the work you can't get to.",
        },
        {
          etiqueta: "What we don't need",
          texto: "Access to your systems. Anybody's personal data. A budget.",
        },
      ],
      cta: "Write with the subject already filled in",
      copiaAntes: "or copy",
      correo: {
        asunto: "Relevo — interested organisation",
        cuerpo: [
          "Hello,",
          "",
          "Organisation:",
          "What we do:",
          "What work we can't get to (translation / plain language / classification):",
          "We can send real examples: yes / no",
          "",
          "Who signs the written permission:",
        ],
      },
    },

    oss: {
      boton: "I maintain an open source project",
      titulo: "For an open source project",
      intro:
        "Nothing leaves your repository without two permissions from you, and you write both of them yourself, in your repository, where you can withdraw them whenever you like.",
      filas: [
        {
          etiqueta: "Permission 1",
          texto:
            "A public URL in your repo saying Relevo may draw tasks from this project. Without it none of your tasks exist — and that check isn't a warning somebody can ignore: the task cannot even be constructed.",
        },
        {
          etiqueta: "Permission 2",
          texto:
            "For code, one more: the specific issue has to be marked by you as open to AI help. No marked issue, no patch — and only one per session.",
        },
        {
          etiqueta: "Who reaches you",
          texto:
            "A person who has read the whole diff and signs that they did. Not a bot wearing your label.",
        },
        {
          etiqueta: "How you stop it",
          texto:
            "You delete the opt-in URL. No need to tell us, wait for us to approve it, or log into any dashboard.",
        },
      ],
      bloqueCodigo: [
        "# AI-CONTRIBUTIONS.md",
        "This project accepts tasks via Relevo.",
        "Only issues labelled `ai-assisted-ok`.",
        "Authorised by: @your-handle",
      ],
      cta: "Write with the subject already filled in",
      copiaAntes: "or copy",
      correo: {
        asunto: "Relevo — interested open source project",
        cuerpo: [
          "Hello,",
          "",
          "Project:",
          "Repository:",
          "I am a maintainer with authority to allow this: yes / no",
          "What kind of task fits (documentation / translation / specific issues):",
          "",
          "Questions or conditions before I publish the opt-in:",
        ],
      },
    },
  },

  estado: {
    etiqueta: "Where we are",
    titulo: "There is no pilot yet. You are reading the beginning.",
    parrafos: [
      "There are no active volunteers, no completed tasks and no organisation on board. What there is: the software written, the rules decided, and this page looking for the first ones. I would rather say it here than let you find out later.",
      "A person answers, not a form. We are few and nobody is on call: it may take a while. If what you have read doesn't fit you, hearing that helps too — quite a lot, in fact.",
    ],
  },

  pie: {
    licencia: "Relevo is free software, AGPL-3.0.",
    repo: "Code and decisions on GitHub",
  },
};
