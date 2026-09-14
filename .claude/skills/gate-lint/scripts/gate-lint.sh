#!/usr/bin/env bash
#
# gate-lint.sh — escáner DETERMINISTA de "gates que no pueden ponerse rojos" (solo bash + grep).
# Parte de la skill `gate-lint`. Busca en los workflows de CI y en los scripts del framework los
# mecanismos con los que un gate deja de morder (`continue-on-error: true`, `|| true`, `--advisory`,
# `| tail -1`, `set +e`, `allow-failure`) y exige que cada uno esté DECLARADO:
#
#   - `ratchet-until: YYYY-MM-DD <ref>`  → deuda temporal con fecha y dueño (T-XXX o #issue).
#   - `gate-lint-allow: <motivo>`        → permanente por diseño (p.ej. un smoke informativo).
#
# Sin marcador, con el ratchet caducado o con el marcador incompleto: BLOQUEA. "Una deuda sin fecha
# es una decisión que nadie tomó" (ver Contexto_Base_SRE/03_Arquitectura_Viva/doctrina_gates_honestos.md).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PATTERNS_FILE="${SKILL_DIR}/presets/patterns.txt"
SAMPLES_FILE="${SKILL_DIR}/presets/self-test-samples.txt"
SELF="${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}")"

# Etiquetas que TAMBIEN se buscan en scripts de shell. El resto (`|| true`, `continue-on-error`…) es
# idiomático y legítimo en bash —los hooks son fail-open por doctrina— y marcarlo sería ruido.
SCRIPT_SCOPE_LABELS=" tail-1 set-plus-e "

RATCHET_TAG="ratchet-until:"
ALLOW_TAG="gate-lint-allow:"

usage() {
  cat <<'EOF'
gate-lint.sh — escáner de gates que no pueden ponerse rojos (bash + grep, sin deps)

USO:
  gate-lint.sh [--today YYYY-MM-DD] [<raíz>]
  gate-lint.sh --self-test
  gate-lint.sh --help

ARGUMENTOS:
  <raíz>                Raíz del repo a escanear (por defecto: directorio actual).

OPCIONES:
  --today YYYY-MM-DD    Fija "hoy" para evaluar la caducidad de los ratchets (tests/reproducible).
  --self-test           Se corre a sí mismo contra fixtures temporales y comprueba que SABE
                        ponerse rojo (sin marcador, ratchet caducado) y verde (declarado).
  --help, -h            Esta ayuda.

QUE ESCANEA:
  <raíz>/.github/workflows/*.yml|*.yaml     → todos los patrones de presets/patterns.txt
  <raíz>/.claude/skills/*/scripts/*.sh      → solo las etiquetas `tail-1` y `set-plus-e`
  <raíz>/.claude/hooks/*.sh                 → solo las etiquetas `tail-1` y `set-plus-e`
  Las líneas que son SOLO comentario se ignoran (documentar un patrón no es usarlo).

MARCADORES (en la MISMA línea del hallazgo o en la INMEDIATAMENTE anterior):
  ratchet-until: YYYY-MM-DD <ref>   Deuda con caducidad y dueño (<ref> = T-XXX, #123 o issue 123).
                                    Vigente → no bloquea. Caducada → CADUCADO, bloquea.
                                    Sin fecha válida o sin ref → bloquea.
                                    Fecha inexistente (2026-13-45) → INVÁLIDA, bloquea.
  gate-lint-allow: <motivo>         Advisory permanente por diseño. Motivo vacío → bloquea.

SALIDA:
  Un hallazgo por línea: `fichero:línea · <etiqueta> · <estado>`
  Resumen contable + VEREDICTO.

EXIT CODES (convención de scripts-gate del framework, ver doctrina_gates_honestos.md):
  0  Verde: sin hallazgos, o todos declarados (permitidos / ratchets vigentes).
  1  Rojo: al menos un hallazgo bloqueante (sin marcador, caducado o marcador incompleto).
  2  Error de uso (flag desconocido, fecha mal formada, raíz inexistente).
  3  No aplica: no hay workflows ni scripts que escanear en esa raíz.
  4  No pude decidir (falta o está vacío presets/patterns.txt) → fail-closed.

EJEMPLOS:
  gate-lint.sh .                          # gate duro del repo (lo que corre CI)
  gate-lint.sh --today 2027-01-01 .       # ¿qué ratchets habrán caducado?
  gate-lint.sh --self-test                # ¿este gate sabe ponerse rojo?
EOF
}

# ---------------------------------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------------------------------

# Quita espacios/tabs por delante y por detrás (sin subprocesos).
trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# Devuelve 0 si la línea es SOLO un comentario (`#` como primer carácter no-blanco).
is_comment_only() {
  local t
  t="$(trim "$1")"
  case "$t" in
    '#'*) return 0 ;;
    *) return 1 ;;
  esac
}

# Devuelve 0 si $1 es un día REAL del calendario, no solo algo con FORMA de fecha. `2026-13-45` y
# `2026-02-31` cumplen `[0-9]{4}-[0-9]{2}-[0-9]{2}` y no existen — y como ninguna fecha imposible es
# menor que hoy, un ratchet con esa fecha NUNCA caduca: un advisory permanente disfrazado de deuda con
# plazo, que es justo lo que este escáner existe para impedir (T-195-B/H3). `date -d` normaliza y
# rechaza los días que no existen; si no coincide con lo escrito, la fecha no es una fecha.
is_real_date() {
  local d="$1" norm
  norm="$(date -u -d "$d" +%Y-%m-%d 2>/dev/null)" || return 1
  [ "$norm" = "$d" ]
}

# Busca el marcador $1 en las líneas dadas. Devuelve 0 si está (con su texto en MTEXT) y 1 si no.
# Presencia y contenido son distintos a propósito: un `gate-lint-allow:` VACIO está presente y tiene
# que bloquear diciendo que falta el motivo, no confundirse con "no hay marcador".
# Uso: has_marker "<tag>" "<línea>" "<línea anterior>"
MTEXT=""
has_marker() {
  local tag="$1"
  shift
  local l
  MTEXT=""
  for l in "$@"; do
    case "$l" in
      *"$tag"*)
        MTEXT="${l#*"$tag"}"
        return 0
        ;;
    esac
  done
  return 1
}

# Clasifica un hallazgo. Escribe en STATE (texto para el informe) y BLOCKING (0/1).
# Uso: classify "<línea>" "<línea anterior>" "<hoy>"
STATE=""
BLOCKING=1
classify() {
  local line="$1" prev="$2" today="$3"
  local raw date ref motivo

  if has_marker "$RATCHET_TAG" "$line" "$prev"; then
    raw="$MTEXT"
    date="$(printf '%s' "$raw" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)"
    ref="$(printf '%s' "$raw" | grep -oiE '(T-[0-9]+[A-Za-z0-9-]*|#[0-9]+|(issue|gh)[ #-]*[0-9]+)' | head -1 || true)"
    if [ -z "$date" ] || [ -z "$ref" ]; then
      STATE="ratchet-until INCOMPLETO (falta fecha YYYY-MM-DD y/o ref T-XXX|#issue)"
      BLOCKING=1
      return 0
    fi
    if ! is_real_date "$date"; then
      STATE="ratchet-until con FECHA INVÁLIDA ($date no existe) — una fecha imposible nunca caduca"
      BLOCKING=1
      return 0
    fi
    if [[ "$date" < "$today" ]]; then
      STATE="CADUCADO el $date ($ref) — apriétalo o renegocia la fecha"
      BLOCKING=1
    else
      STATE="ratchet hasta $date ($ref)"
      BLOCKING=0
    fi
    return 0
  fi

  if has_marker "$ALLOW_TAG" "$line" "$prev"; then
    motivo="$(trim "$MTEXT")"
    if [ -z "$motivo" ]; then
      STATE="gate-lint-allow SIN MOTIVO"
      BLOCKING=1
    else
      STATE="permitido: $motivo"
      BLOCKING=0
    fi
    return 0
  fi

  STATE="SIN CADUCIDAD"
  BLOCKING=1
}

# ---------------------------------------------------------------------------------------------------
# Escaneo
# ---------------------------------------------------------------------------------------------------

# Uso: scan <raíz> <hoy>. Imprime el informe. Exit 0/1/3/4 según la convención.
scan() {
  local root="$1" today="$2"
  local f label re n_targets=0
  local labels=() regexes=() targets=()

  if [ ! -s "$PATTERNS_FILE" ]; then
    echo "gate-lint: no pude leer los patrones ($PATTERNS_FILE) → no puedo decidir." >&2
    return 4
  fi
  while IFS= read -r pl || [ -n "$pl" ]; do
    [ -z "$(trim "$pl")" ] && continue
    is_comment_only "$pl" && continue
    label="$(trim "${pl%%|*}")"
    re="${pl#*|}"
    if [ -z "$label" ] || [ -z "$re" ]; then continue; fi
    labels+=("$label")
    regexes+=("$re")
  done < "$PATTERNS_FILE"

  if [ "${#labels[@]}" -eq 0 ]; then
    echo "gate-lint: $PATTERNS_FILE no define ningún patrón → no puedo decidir." >&2
    return 4
  fi

  for f in "$root"/.github/workflows/*.yml "$root"/.github/workflows/*.yaml; do
    [ -f "$f" ] && targets+=("workflow|$f")
  done
  for f in "$root"/.claude/skills/*/scripts/*.sh "$root"/.claude/hooks/*.sh; do
    [ -f "$f" ] && targets+=("script|$f")
  done
  n_targets="${#targets[@]}"

  if [ "$n_targets" -eq 0 ]; then
    echo "VEREDICTO: NO APLICA — no hay workflows ni scripts que escanear en '$root'."
    return 3
  fi

  local findings i scope ln prev_ln line prev
  findings="$(mktemp)"
  # shellcheck disable=SC2064  # el path se expande AHORA a propósito (variable local).
  trap "rm -f '$findings'" RETURN

  local t
  for t in "${targets[@]}"; do
    scope="${t%%|*}"
    f="${t#*|}"
    for ((i = 0; i < ${#labels[@]}; i++)); do
      label="${labels[$i]}"
      re="${regexes[$i]}"
      if [ "$scope" = "script" ] && [[ "$SCRIPT_SCOPE_LABELS" != *" $label "* ]]; then
        continue
      fi
      # `grep -- "$re"`: hay regex que empiezan por `-` (p.ej. `--advisory`) y sin el `--` grep los
      # toma por opciones → el patrón no casaría nunca, que es justo el fallo que este gate persigue.
      while IFS= read -r ln; do
        [ -z "$ln" ] && continue
        line="$(sed -n "${ln}p" "$f")"
        is_comment_only "$line" && continue
        prev=""
        prev_ln=$((ln - 1))
        [ "$prev_ln" -ge 1 ] && prev="$(sed -n "${prev_ln}p" "$f")"
        classify "$line" "$prev" "$today"
        printf '%s\t%s\t%s\t%s\t%s\n' "$f" "$ln" "$label" "$STATE" "$BLOCKING" >> "$findings"
      done < <(grep -nE -- "$re" "$f" 2>/dev/null | cut -d: -f1 || true)
    done
  done

  local blk=0 rat=0 per=0 state blocking
  echo "gate-lint · $n_targets fichero(s), ${#labels[@]} patrón(es), hoy=$today"
  echo
  while IFS=$'\t' read -r f ln label state blocking; do
    printf '%s:%s · %s · %s\n' "$f" "$ln" "$label" "$state"
    if [ "$blocking" = "1" ]; then
      blk=$((blk + 1))
    elif [ "${state#permitido:}" != "$state" ]; then
      per=$((per + 1))
    else
      rat=$((rat + 1))
    fi
  done < <(sort -t$'\t' -k1,1 -k2,2n "$findings")

  [ "$((blk + rat + per))" -gt 0 ] && echo
  echo "resumen: bloqueantes=$blk · ratchets=$rat · permitidos=$per"
  if [ "$blk" -gt 0 ]; then
    echo "VEREDICTO: ROJO — $blk gate(s) sin declarar. Pon 'ratchet-until: YYYY-MM-DD <ref>' (deuda con"
    echo "           dueño y fecha) o 'gate-lint-allow: <motivo>' (advisory por diseño), o quita el flag."
    return 1
  fi
  echo "VEREDICTO: VERDE — todo advisory está declarado (permitido) o tiene ratchet vigente."
  return 0
}

# ---------------------------------------------------------------------------------------------------
# Self-test: este gate tiene que saber ponerse ROJO. Si no, no vale nada (T-170).
# ---------------------------------------------------------------------------------------------------

self_test() {
  local tmp fail=0
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064  # expansión inmediata a propósito.
  trap "rm -rf '$tmp'" RETURN

  ok() { echo "ok: $1"; }
  bad() {
    echo "FAIL: $1"
    fail=1
  }

  if [ ! -s "$SAMPLES_FILE" ]; then
    echo "FAIL: falta el fichero de muestras ($SAMPLES_FILE)"
    return 1
  fi

  # Etiquetas declaradas y sus muestras. Toda etiqueta necesita muestra o el self-test es ciego.
  local labels=() label pl
  while IFS= read -r pl || [ -n "$pl" ]; do
    [ -z "$(trim "$pl")" ] && continue
    is_comment_only "$pl" && continue
    label="$(trim "${pl%%|*}")"
    [ -n "$label" ] && labels+=("$label")
  done < "$PATTERNS_FILE"

  if [ "${#labels[@]}" -eq 0 ]; then
    echo "FAIL: patterns.txt no declara ningún patrón"
    return 1
  fi

  local sample
  for label in "${labels[@]}"; do
    sample="$(grep -m1 "^${label}|" "$SAMPLES_FILE" | sed 's/^[^|]*|//' || true)"
    if [ -z "$sample" ]; then
      bad "el patrón '$label' no tiene muestra en presets/self-test-samples.txt (self-test ciego)"
    fi
  done

  # --- Fixtures ------------------------------------------------------------------------------------
  local root_desnudo="$tmp/desnudo" root_caducado="$tmp/caducado"
  local root_declarado="$tmp/declarado" root_vacio="$tmp/vacio"
  local r
  for r in "$root_desnudo" "$root_caducado" "$root_declarado"; do
    mkdir -p "$r/.github/workflows"
    printf 'name: fixture\njobs:\n  x:\n    steps:\n' > "$r/.github/workflows/w.yml"
  done
  mkdir -p "$root_vacio"

  local n=0
  for label in "${labels[@]}"; do
    sample="$(grep -m1 "^${label}|" "$SAMPLES_FILE" | sed 's/^[^|]*|//' || true)"
    [ -z "$sample" ] && continue
    printf '%s\n' "$sample" >> "$root_desnudo/.github/workflows/w.yml"
    printf '      # %s 2020-01-01 T-000\n%s\n' "$RATCHET_TAG" "$sample" \
      >> "$root_caducado/.github/workflows/w.yml"
    # Mitad con permiso por diseño, mitad con ratchet vigente: los dos caminos verdes se ejercitan.
    if [ $((n % 2)) -eq 0 ]; then
      printf '      # %s muestra del self-test\n%s\n' "$ALLOW_TAG" "$sample" \
        >> "$root_declarado/.github/workflows/w.yml"
    else
      printf '      # %s 2026-06-01 T-194\n%s\n' "$RATCHET_TAG" "$sample" \
        >> "$root_declarado/.github/workflows/w.yml"
    fi
    n=$((n + 1))
  done

  # --- Aserciones ----------------------------------------------------------------------------------
  local out rc

  # 1) Sin marcador → ROJO, y nombra CADA patrón.
  rc=0; out="$(bash "$SELF" --today 2026-01-01 "$root_desnudo")" || rc=$?
  if [ "$rc" -eq 1 ]; then ok "sin marcador → exit 1"; else
    bad "sin marcador debía dar exit 1, dio $rc"
  fi
  for label in "${labels[@]}"; do
    if printf '%s' "$out" | grep -q "· ${label} · SIN CADUCIDAD"; then
      ok "sin marcador → '$label' listado como SIN CADUCIDAD"
    else
      bad "sin marcador → falta el hallazgo '$label' (patrón que no detecta nada)"
    fi
  done
  if printf '%s' "$out" | grep -q "bloqueantes=${#labels[@]} "; then
    ok "sin marcador → los ${#labels[@]} hallazgos cuentan como bloqueantes"
  else
    bad "sin marcador → el resumen no cuenta ${#labels[@]} bloqueantes: $(printf '%s' "$out" | grep resumen: || true)"
  fi

  # 2) Ratchet caducado → ROJO, y lo dice.
  rc=0; out="$(bash "$SELF" --today 2026-01-01 "$root_caducado")" || rc=$?
  if [ "$rc" -eq 1 ]; then ok "ratchet caducado → exit 1"; else
    bad "ratchet caducado debía dar exit 1, dio $rc"
  fi
  if printf '%s' "$out" | grep -q "CADUCADO el 2020-01-01 (T-000)"; then
    ok "ratchet caducado → informa fecha y ref"
  else
    bad "ratchet caducado → no informa 'CADUCADO el 2020-01-01 (T-000)'"
  fi

  # 3) Declarado (permiso + ratchet vigente) → VERDE.
  rc=0; out="$(bash "$SELF" --today 2026-01-01 "$root_declarado")" || rc=$?
  if [ "$rc" -eq 0 ]; then ok "declarado → exit 0"; else
    bad "declarado debía dar exit 0, dio $rc: $(printf '%s' "$out" | grep -E 'SIN CADUCIDAD|CADUCADO' | head -3)"
  fi
  if printf '%s' "$out" | grep -q "bloqueantes=0 "; then
    ok "declarado → bloqueantes=0"
  else
    bad "declarado → el resumen no dice bloqueantes=0"
  fi
  if printf '%s' "$out" | grep -q "permitido: muestra del self-test" &&
    printf '%s' "$out" | grep -q "ratchet hasta 2026-06-01 (T-194)"; then
    ok "declarado → informa los dos estados verdes (permitido y ratchet vigente)"
  else
    bad "declarado → no informa 'permitido:' y 'ratchet hasta' a la vez"
  fi

  # 4) Sensibilidad de la caducidad: el MISMO fixture verde se pone rojo si avanzo el reloj.
  rc=0; out="$(bash "$SELF" --today 2026-12-31 "$root_declarado")" || rc=$?
  if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "CADUCADO el 2026-06-01"; then
    ok "sensibilidad: el ratchet vigente caduca al avanzar --today (mismo fixture, rojo)"
  else
    bad "sensibilidad: con --today 2026-12-31 el ratchet 2026-06-01 debía caducar (exit=$rc)"
  fi

  # 5) Nada que escanear → exit 3 (no aplica), no un verde silencioso.
  rc=0; out="$(bash "$SELF" --today 2026-01-01 "$root_vacio")" || rc=$?
  if [ "$rc" -eq 3 ]; then ok "raíz sin workflows ni scripts → exit 3 (no aplica)"; else
    bad "raíz vacía debía dar exit 3, dio $rc"
  fi

  echo
  if [ "$fail" -ne 0 ]; then
    echo "SELF-TEST: ROJO — el escáner no cumple sus propias invariantes (ver FAIL de arriba)."
    return 1
  fi
  echo "SELF-TEST: VERDE — el escáner sabe ponerse rojo (sin marcador, caducado) y verde (declarado)."
  return 0
}

# ---------------------------------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------------------------------

MODE="scan"
TODAY=""
ROOT=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --self-test) MODE="self-test" ;;
    --today)
      shift
      TODAY="${1-}"
      ;;
    --today=*) TODAY="${1#*=}" ;;
    -*)
      echo "gate-lint: opción desconocida: $1" >&2
      echo "gate-lint: prueba 'gate-lint.sh --help'" >&2
      exit 2
      ;;
    *)
      if [ -n "$ROOT" ]; then
        echo "gate-lint: solo se admite una raíz (ya tenía '$ROOT', llegó '$1')" >&2
        exit 2
      fi
      ROOT="$1"
      ;;
  esac
  shift
done

if [ -n "$TODAY" ] && ! printf '%s' "$TODAY" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  echo "gate-lint: --today espera YYYY-MM-DD, llegó '$TODAY'" >&2
  exit 2
fi
[ -z "$TODAY" ] && TODAY="$(date -u +%Y-%m-%d)"

if [ "$MODE" = "self-test" ]; then
  self_test
  exit "$?"
fi

[ -z "$ROOT" ] && ROOT="."
if [ ! -d "$ROOT" ]; then
  echo "gate-lint: la raíz '$ROOT' no es un directorio" >&2
  exit 2
fi

rc=0
scan "$ROOT" "$TODAY" || rc=$?
exit "$rc"
