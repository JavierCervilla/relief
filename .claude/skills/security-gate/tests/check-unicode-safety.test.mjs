// =============================================================================
// Tests del gate anti-tag-smuggling Unicode (T-166). Node PURO (node:test + node:assert), sin deps.
//
// CRÍTICO (design §4): NINGÚN carácter peligroso se commitea literal. Todas las cadenas peligrosas se
// GENERAN en runtime con String.fromCodePoint(0x...) y se escriben a un TEMPORAL (os.tmpdir). Si un
// literal peligroso viviera en este fichero, el propio gate lo cazaría en CI (el scanner escanea
// .claude/skills/**), que es justo lo que queremos.
//
// Correr:  node --test .claude/skills/security-gate/tests/check-unicode-safety.test.mjs
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCANNER = fileURLToPath(new URL("../scripts/check-unicode-safety.mjs", import.meta.url));

// cwd por defecto = tmpdir (NO es un repo git) → skipRequested() no interfiere en los tests de fichero.
function run(args, cwd) {
  const r = spawnSync(process.execPath, [SCANNER, ...args], { cwd: cwd ?? tmpdir(), encoding: "utf8" });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}
function tmpFile(name, content) {
  const dir = mkdtempSync(join(tmpdir(), "uni-"));
  const p = join(dir, name);
  writeFileSync(p, content);
  return { dir, p };
}

// --- Una entrada por clase: si se quita esa clase del scanner, SU test se pone rojo (ojo mutante). --
const CLASSES = [
  { cp: 0x200b, hex: "200B", cls: "zero-width" },
  { cp: 0x202e, hex: "202E", cls: "bidi" },
  { cp: 0xe0001, hex: "E0001", cls: "tag" },
  { cp: 0x180e, hex: "180E", cls: "mongolian-vs" },
  { cp: 0x3164, hex: "3164", cls: "filler" },
  { cp: 0x2062, hex: "2062", cls: "invisible-math" },
  { cp: 0xfff9, hex: "FFF9", cls: "interlinear" },
];
for (const c of CLASSES) {
  test(`detecta la clase ${c.cls} (U+${c.hex})`, () => {
    const { p } = tmpFile("f.md", `antes${String.fromCodePoint(c.cp)}despues\n`);
    const r = run([p]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, new RegExp(`U\\+${c.hex} \\(${c.cls}\\)`), r.out);
  });
}

test("--fix limpia y deja el texto legítimo intacto (tab + emoji ZWJ + acentos)", () => {
  const legit = "\tHola café 👨‍🍳 mundo\n"; // el 👨‍🍳 lleva un ZWJ legítimo que NO debe tocarse
  const zwsp = String.fromCodePoint(0x200b);
  const { p } = tmpFile("f.md", "\tHola café 👨‍🍳 mundo" + zwsp + "\n");
  const r = run(["--fix", p]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(readFileSync(p, "utf8"), legit);
});

test("[unicode-allow: U+E0001] deja pasar SOLO ese codepoint en esa línea (y NO otro)", () => {
  const tag1 = String.fromCodePoint(0xe0001);
  const tag2 = String.fromCodePoint(0xe0002);
  const content =
    `A${tag1}B [unicode-allow: U+E0001 ilustra el ataque en docs]\n` +
    `C${tag2}D [unicode-allow: U+E0001 este marcador NO cubre E0002]\n`;
  const { p } = tmpFile("f.md", content);
  const r = run([p]);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.out, /U\+E0002 \(tag\)/); // el no permitido SÍ se reporta
  assert.doesNotMatch(r.out, /U\+E0001/); // el permitido NO
});

test("[skip-unicode] en el asunto del commit salta el run entero", () => {
  const dir = mkdtempSync(join(tmpdir(), "unigit-"));
  const git = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@t.t");
  git("config", "user.name", "t");
  writeFileSync(join(dir, "dirty.md"), `x${String.fromCodePoint(0x200b)}y\n`);
  git("add", ".");
  git("commit", "-q", "-m", "chore: prueba [skip-unicode]");
  const skipped = run(["dirty.md"], dir);
  assert.equal(skipped.code, 0, skipped.out + skipped.err); // el asunto lleva el marcador → salta

  // Control: nuevo commit SIN el marcador en el asunto → vuelve a bloquear el fichero sucio.
  writeFileSync(join(dir, "extra.md"), "solo texto\n");
  git("add", ".");
  git("commit", "-q", "-m", "chore: sin marcador");
  const blocked = run(["dirty.md"], dir);
  assert.equal(blocked.code, 1, blocked.out + blocked.err);
});

test("--exclude omite el fichero sucio (substring y glob)", () => {
  const dir = mkdtempSync(join(tmpdir(), "uniex-"));
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "sub", "bad.md"), `x${String.fromCodePoint(0x200b)}y\n`);
  assert.equal(run([dir]).code, 1); // sin exclude → bloquea
  assert.equal(run([dir, "--exclude", "bad.md"]).code, 0); // substring
  assert.equal(run([dir, "--exclude", "**/bad.md"]).code, 0); // glob
});

test("no marca el ZWJ de una secuencia de emoji (cocinero y familia)", () => {
  const { p } = tmpFile("f.md", "cocinero 👨‍🍳 y familia 👨‍👩‍👧 ok\n");
  assert.equal(run([p]).code, 0);
});

test("exit 0 en un fichero limpio (tab, acentos y emoji normal)", () => {
  const { p } = tmpFile("f.md", "solo texto legítimo con tab\ty un emoji 🎉 suelto\n");
  assert.equal(run([p]).code, 0);
});

// --- Enmienda T-166 (evasión por encoding): F1 sin NUL en el fuente, F2 cobertura + bypass -------

test("F1: el fuente del scanner no contiene NINGÚN byte NUL (texto revisable + auto-escaneable)", () => {
  const raw = readFileSync(SCANNER); // en binario: un Buffer
  assert.equal(raw.indexOf(0), -1, `el scanner tiene ${raw.filter((b) => b === 0).length} NUL(s)`);
});

test("F2: un NUL temprano en un .md de texto es HALLAZGO (bypass por prefijo-NUL cerrado)", () => {
  // Antes: el NUL disparaba la heurística binaria y el tag-smuggle tras él pasaba con exit 0.
  // El NUL y el tag se GENERAN en runtime (nunca literales en este fichero).
  const smuggle = "harmless" + "\x00" + " instruccion oculta " + String.fromCodePoint(0xe0001) + "x\n";
  const { p } = tmpFile("bypass.md", smuggle);
  const r = run([p]);
  assert.equal(r.code, 1, r.out + r.err); // antes daba 0
  assert.match(r.out, /U\+0000/, r.out); // se reporta el U+0000 en superficie de texto
});

test("F2: una extensión binaria legítima (.woff2) con NUL se salta SIN marcarla (cobertura aparte)", () => {
  const dir = mkdtempSync(join(tmpdir(), "unifont-"));
  const p = join(dir, "font.woff2");
  writeFileSync(p, Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x00, 0x00])); // "wOF2" + NUL binario
  const r = run([p]);
  assert.equal(r.code, 0, r.out + r.err); // font legítima: no es un ataque
  assert.equal(r.out.includes("U+0000"), false, r.out); // NO se marca como hallazgo
  assert.match(r.out, /0 fichero\(s\) escaneado\(s\).*saltados 1 por binario/, r.out); // cobertura honesta
});

test("exit 2 con opción desconocida", () => {
  assert.equal(run(["--bogus"]).code, 2);
});

test("exit 2 con --exclude sin valor", () => {
  assert.equal(run(["--exclude"]).code, 2);
});
