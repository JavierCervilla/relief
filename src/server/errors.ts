/**
 * Errores con código.
 *
 * Los códigos existen para que los tests afirmen **por qué** falló algo y no sólo que falló: un test que
 * comprueba "lanza" pasa igual cuando la causa es la correcta y cuando es un typo en el nombre de un
 * campo. Y para que el voluntario lea un motivo accionable en vez de un stack trace.
 */

export type RelevoErrorCode =
  | "task_not_found"
  | "task_not_available"
  | "claimed_by_other"
  | "claim_expired"
  | "no_claim"
  | "session_quota_exceeded"
  | "daily_quota_exceeded"
  | "patch_quota_exceeded"
  | "result_type_mismatch"
  | "label_not_allowed";

export class RelevoError extends Error {
  readonly code: RelevoErrorCode;

  constructor(code: RelevoErrorCode, message: string) {
    super(message);
    this.name = "RelevoError";
    this.code = code;
  }
}
