#!/usr/bin/env bash
#
# security-gate.sh — runner DETERMINISTA de la escalera de seguridad (sin cloud, sin LLM).
# Parte de la skill `security-gate` (T-061-B). Materializa la escalera de la doctrina_guardian.md:
#   (1) Secretos   — gitleaks (no negociable; una fuga = severidad máxima → recordar ROTAR).
#   (2) SAST       — semgrep con el ruleset VENDORIZADO de presets/semgrep (NUNCA el registry).
#   (3) Deps       — osv-scanner (CVE) + npm audit si hay package-lock.json.
# La "lectura con criterio" (peldaño 4) y el red-team (peldaño 5) son del rol `seguridad`, fuera
# de este script. Reproducible en local y en CI: el veredicto es el mismo offline.
#
# Degradación grácil: si una herramienta falta, AVISA y degrada (no peta). En CI se instalan →
# ahí es gate duro. Toda la salida va REDACTADA (gitleaks --redact; nunca volcamos secretos).
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SEMGREP_RULES="${SKILL_DIR}/presets/semgrep"
GITLEAKS_CONFIG="${SKILL_DIR}/presets/gitleaks.toml"

usage() {
  cat <<'EOF'
security-gate.sh — escalera de seguridad determinista (gitleaks + semgrep + osv-scanner, sin cloud)

USO:
  security-gate.sh [--help] [--staged] [<path> ...]

  <path>      Ficheros y/o directorios a escanear (por defecto: la raíz del repo git, o el
              directorio actual si no hay repo).
  --staged    Escanea SOLO el diff staged del repo (secretos vía `gitleaks git --staged`).
              Pensado para una pasada rápida pre-commit. SAST/deps siguen sobre el árbol.
  --deps-advisory
              Degrada el peldaño (3) Dependencias a ADVISORY: reporta las CVE pero NO bloquea
              (no cuenta como hallazgo). Ratchet honesto (T-044/T-032): se usa para onboardar un
              proyecto con deuda de deps PRE-EXISTENTE sin defangar secretos/SAST (que sí bloquean
              desde el día 1). Quítalo cuando las deps estén saneadas. Secretos y SAST nunca degradan.

ESCALERA (en orden, cada peldaño bloqueante):
  1) Secretos  — gitleaks dir/git con presets/gitleaks.toml (--redact).
  2) SAST      — semgrep --config presets/semgrep --metrics=off (ruleset vendorizado).
  3) Deps      — osv-scanner (+ npm audit si hay package-lock.json).

ESCAPE (excepción trazada, lo soportan las herramientas de serie):
  • secretos: comentario `gitleaks:allow` en la línea del hallazgo.
  • SAST:     comentario `// nosemgrep: <id-regla>` (o `# nosemgrep`) en la línea.
  Úsalos con razón; quedan en el diff.

EXIT CODES:
  0  Limpio (verde para CI/verificador/hook).
  1  Hallazgo bloqueante (secreto, patrón SAST crítico/alto, o CVE).
  2  Error de uso (path inexistente, etc.).

DEGRADACION:
  Si una herramienta falta (command -v), se avisa y se OMITE ese peldaño (no peta). En CI las
  herramientas se instalan → gate duro. Versiones de referencia: gitleaks v8, semgrep 1.16x,
  osv-scanner 1.9.x.
EOF
}

STAGED=0
DEPS_ADVISORY=0
declare -a INPUTS=()
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --staged) STAGED=1 ;;
    --deps-advisory) DEPS_ADVISORY=1 ;;
    -*) echo "ERROR: opción desconocida: $arg" >&2; usage >&2; exit 2 ;;
    *) INPUTS+=("$arg") ;;
  esac
done

# Resuelve el target por defecto: raíz del repo git, o cwd.
if [[ ${#INPUTS[@]} -eq 0 ]]; then
  if root="$(git rev-parse --show-toplevel 2>/dev/null)" && [[ -n "$root" ]]; then
    INPUTS=("$root")
  else
    INPUTS=(".")
  fi
fi
for p in "${INPUTS[@]}"; do
  if [[ ! -e "$p" ]]; then
    echo "ERROR: path inexistente: $p" >&2
    exit 2
  fi
done

FINDINGS=0          # peldaños con hallazgo bloqueante
SECRET_LEAK=0       # ¿hubo fuga de secreto? → recordar ROTAR
declare -a SKIPPED=()

echo "== security-gate :: escalera de seguridad determinista (sin cloud) =="
echo "   targets: ${INPUTS[*]}"
echo

# -------------------------------- (1) SECRETOS (gitleaks) --------------------------------
echo "--- (1) Secretos :: gitleaks ---"
if command -v gitleaks >/dev/null 2>&1; then
  gl_cfg=()
  [[ -f "$GITLEAKS_CONFIG" ]] && gl_cfg=(-c "$GITLEAKS_CONFIG")
  if [[ "$STAGED" -eq 1 ]]; then
    # Diff staged del repo actual (good for pre-commit, según `gitleaks git --help`).
    repo="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
    gitleaks git "$repo" --staged "${gl_cfg[@]}" --no-banner --redact --exit-code 1 >/dev/null 2>&1
    rc=$?
  else
    rc=0
    for p in "${INPUTS[@]}"; do
      # `gitleaks dir` escanea directorios o ficheros (alias: file, directory).
      gitleaks dir "$p" "${gl_cfg[@]}" --no-banner --redact --exit-code 1 >/dev/null 2>&1 || rc=$?
    done
  fi
  if [[ "$rc" -eq 0 ]]; then
    echo "    OK: sin secretos detectados."
  else
    echo "    BLOQUEANTE: gitleaks detectó secreto(s) (salida redactada, secretos NO impresos)."
    echo "    >>> RECOMENDACION: ROTA de inmediato cualquier credencial expuesta y elimínala del historial."
    FINDINGS=$((FINDINGS+1)); SECRET_LEAK=1
  fi
else
  echo "    WARN: gitleaks no instalado → peldaño OMITIDO (degrada; en CI es gate duro)."
  SKIPPED+=("gitleaks")
fi
echo

# -------------------------------- (2) SAST (semgrep) --------------------------------
echo "--- (2) SAST :: semgrep (ruleset vendorizado) ---"
if command -v semgrep >/dev/null 2>&1; then
  if [[ ! -d "$SEMGREP_RULES" ]]; then
    echo "    WARN: ruleset vendorizado ausente ($SEMGREP_RULES) → peldaño OMITIDO."
    SKIPPED+=("semgrep-rules")
  else
    # --config <dir vendorizado> (NUNCA p/... ni auto); --metrics=off (sin telemetría/red);
    # --error → exit 1 si hay findings. Severidad ERROR = bloqueante; WARNING/INFO informativo.
    sg_json="$(semgrep scan --config "$SEMGREP_RULES" --metrics=off --severity=ERROR --json \
                 --quiet "${INPUTS[@]}" 2>/dev/null)"
    n_err=0
    if command -v jq >/dev/null 2>&1 && [[ -n "$sg_json" ]]; then
      n_err="$(printf '%s' "$sg_json" | jq '[.results[]] | length' 2>/dev/null || echo 0)"
    fi
    # Resumen por severidad (corre aparte para contar WARNING sin que bloqueen).
    sg_all="$(semgrep scan --config "$SEMGREP_RULES" --metrics=off --json --quiet "${INPUTS[@]}" 2>/dev/null)"
    n_warn=0
    if command -v jq >/dev/null 2>&1 && [[ -n "$sg_all" ]]; then
      n_warn="$(printf '%s' "$sg_all" | jq '[.results[] | select(.extra.severity=="WARNING")] | length' 2>/dev/null || echo 0)"
    fi
    echo "    severidad: ERROR(bloqueante)=${n_err} | WARNING(informativo)=${n_warn}"
    if [[ "${n_err:-0}" -gt 0 ]]; then
      # Lista archivo:línea:regla (sin volcar el snippet completo).
      if command -v jq >/dev/null 2>&1; then
        printf '%s' "$sg_json" | jq -r '.results[] | "    ERROR \(.path):\(.start.line) [\(.check_id | split(".") | last)]"' 2>/dev/null | head -20
      fi
      echo "    BLOQUEANTE: semgrep encontró patrones de seguridad de severidad ERROR."
      FINDINGS=$((FINDINGS+1))
    else
      echo "    OK: sin patrones SAST de severidad ERROR."
    fi
  fi
else
  echo "    WARN: semgrep no instalado → peldaño OMITIDO (degrada; en CI es gate duro)."
  SKIPPED+=("semgrep")
fi
echo

# -------------------------------- (3) DEPS (osv-scanner + npm audit) --------------------------------
echo "--- (3) Dependencias :: osv-scanner (+ npm audit) ---"
# Los JSON de este peldaño se guardan para que `deps-cut.sh` derive la versión de corte REAL desde los
# avisos individuales (T-158). Sin esto solo queda el rango AGREGADO del gestor, que es la unión de
# todos los avisos del paquete y empuja más lejos de lo necesario.
DEPS_TMP="$(mktemp -d 2>/dev/null || echo "")"
[[ -n "$DEPS_TMP" ]] && trap 'rm -rf "$DEPS_TMP"' EXIT
idx=0
if command -v osv-scanner >/dev/null 2>&1; then
  osv_rc=0
  # T-160: un fallo de EJECUCIÓN no es un peldaño limpio. Sin esta bandera, `osv_rc` se queda en 0
  # tras un rc>1 y el resumen de abajo imprime "OK: sin vulnerabilidades" sobre un escaneo que nunca
  # ocurrió (reproducido en la auditoría T-159 con rc=127).
  osv_err=0
  for p in "${INPUTS[@]}"; do
    [[ -d "$p" ]] || continue
    osv_json="$(osv-scanner scan --format json --recursive "$p" 2>/dev/null)"; rc=$?
    # osv-scanner: exit 0 = sin vulns; 1 = vulns encontradas; >1 = error de ejecución (degrada).
    if [[ "$rc" -eq 1 ]]; then
      n_vuln=0
      if command -v jq >/dev/null 2>&1 && [[ -n "$osv_json" ]]; then
        n_vuln="$(printf '%s' "$osv_json" | jq '[.results[].packages[].vulnerabilities[]] | length' 2>/dev/null || echo 0)"
      fi
      echo "    osv-scanner encontró ${n_vuln} vulnerabilidad(es) de dependencias en $p."
      [[ -n "$DEPS_TMP" && -n "$osv_json" ]] && printf '%s' "$osv_json" > "$DEPS_TMP/osv-$idx.json"
      osv_rc=1
    elif [[ "$rc" -gt 1 ]]; then
      echo "    WARN: osv-scanner error (rc=$rc) en $p → degrada (no bloquea por fallo de ejecución)."
      osv_err=1
    fi
    idx=$((idx+1))
  done
  if [[ "${osv_err:-0}" -eq 1 ]]; then
    echo "    NO COMPROBADO: osv-scanner falló al ejecutarse → este peldaño NO da cobertura."
    SKIPPED+=("osv-scanner(error)")
  elif [[ "$osv_rc" -eq 0 ]]; then
    echo "    OK: osv-scanner sin vulnerabilidades de dependencias."
  elif [[ "$DEPS_ADVISORY" -eq 1 ]]; then
    echo "    ADVISORY: CVE de deps reportadas pero NO bloquean (--deps-advisory, ratchet). Sanea y quita el flag."
  else
    echo "    BLOQUEANTE: CVE de dependencias (osv-scanner)."
    FINDINGS=$((FINDINGS+1))
  fi
else
  echo "    WARN: osv-scanner no instalado → peldaño OMITIDO (degrada; en CI es gate duro)."
  SKIPPED+=("osv-scanner")
fi

# npm audit complementario (solo donde haya package-lock.json).
if command -v npm >/dev/null 2>&1; then
  idx=0
  for p in "${INPUTS[@]}"; do
    if [[ ! -d "$p" || ! -f "$p/package-lock.json" ]]; then idx=$((idx+1)); continue; fi
    audit_json="$(cd "$p" && npm audit --audit-level=high --json 2>/dev/null)"; arc=$?
    [[ -n "$DEPS_TMP" && -n "$audit_json" ]] && printf '%s' "$audit_json" > "$DEPS_TMP/npm-$idx.json"
    n_hi=0
    if command -v jq >/dev/null 2>&1 && [[ -n "$audit_json" ]]; then
      n_hi="$(printf '%s' "$audit_json" | jq '((.metadata.vulnerabilities.high // 0) + (.metadata.vulnerabilities.critical // 0))' 2>/dev/null || echo 0)"
    fi
    if [[ "$arc" -ne 0 && "${n_hi:-0}" -gt 0 ]]; then
      if [[ "$DEPS_ADVISORY" -eq 1 ]]; then
        echo "    ADVISORY: npm audit reporta ${n_hi} vuln(s) high/critical en $p (NO bloquea, ratchet)."
      else
        echo "    BLOQUEANTE: npm audit reporta ${n_hi} vuln(s) high/critical en $p/package-lock.json."
        FINDINGS=$((FINDINGS+1))
      fi
    else
      echo "    OK: npm audit sin vulns high/critical en $p."
    fi
    idx=$((idx+1))
  done
fi

# Corte real desde los avisos (T-158). INFORMATIVO: no cambia el veredicto — quien bloquea sigue
# siendo osv-scanner/npm audit arriba. Solo evita que el rango agregado dicte la versión de corte.
if [[ -n "$DEPS_TMP" ]]; then
  dc="${SCRIPT_DIR}/deps-cut.sh"
  i=0
  for p in "${INPUTS[@]}"; do
    if [[ -f "$DEPS_TMP/osv-$i.json" ]]; then
      if [[ -f "$DEPS_TMP/npm-$i.json" ]]; then
        bash "$dc" --osv "$DEPS_TMP/osv-$i.json" --npm-audit "$DEPS_TMP/npm-$i.json"
      else
        bash "$dc" --osv "$DEPS_TMP/osv-$i.json"
      fi
    fi
    i=$((i+1))
  done
fi
echo

# -------------------------------- VEREDICTO --------------------------------
echo "-------------------------------------------------------------"
if [[ "${#SKIPPED[@]}" -gt 0 ]]; then
  echo "OMITIDOS (no instalados): ${SKIPPED[*]} — en CI son gate duro."
fi
if [[ "$SECRET_LEAK" -eq 1 ]]; then
  echo "FUGA DE SECRETO detectada → ROTA la credencial y purga el historial (severidad máxima)."
fi
if [[ "$FINDINGS" -gt 0 ]]; then
  echo "VEREDICTO: BLOQUEADO (${FINDINGS} peldaño(s) con hallazgo)."
  exit 1
fi
# T-160: "LIMPIO" afirma que se miró todo. Con peldaños sin correr, lo honesto es decir que no hubo
# hallazgos EN LO QUE SÍ SE MIRÓ. Sigue siendo exit 0: degrada, no rompe el commit de nadie.
if [[ "${#SKIPPED[@]}" -gt 0 ]]; then
  echo "VEREDICTO: SIN HALLAZGOS, pero COBERTURA INCOMPLETA (${#SKIPPED[@]} peldaño(s) sin comprobar)."
  exit 0
fi
echo "VEREDICTO: LIMPIO."
exit 0
