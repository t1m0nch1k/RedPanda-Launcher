import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Операция не выполнена";
}

export function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(name, args).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
      throw error;
    }
    throw {
      code: "operation_failed",
      message: getErrorMessage(error),
    } satisfies AppError;
  });
}
