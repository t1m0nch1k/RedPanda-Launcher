import { invoke } from "@tauri-apps/api/core";

export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Account {
  id: string;
  username: string;
  account_type: "Offline" | "Microsoft" | "ElyBy" | string;
  is_active: boolean;
  uuid?: string;
  /** Токены аккаунта не удалось расшифровать: требуется повторный вход. */
  needs_relogin?: boolean;
}

export interface InstallTask {
  id: string;
  project_id: string;
  name: string;
  url: string;
  filename: string;
  source: "modrinth" | "curseforge" | string;
  warning?: string | null;
  sha1?: string | null;
}

export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string;
  html_url: string;
  sha256?: string;
  asset_name?: string;
  size?: number;
  signature?: string;
  key_id?: string;
  manifest_json?: string;
}

export interface AppSettings {
  java_path: string;
  min_memory: number;
  max_memory: number;
  window_width: number;
  window_height: number;
  fullscreen: boolean;
  jvm_args: string;
  instances_sort_mode: string;
  launch_behavior: string;
  show_console: boolean;
  aggressive_optimization: boolean;
  show_snapshots: boolean;
  auto_backup_worlds: boolean;
  theme: string;
  accent_color: string;
  custom_bg_path: string;
  custom_bg_opacity: number;
  custom_bg_blur: number;
  custom_mascot_path: string;
  mascot_preset: string;
  discord_rpc: boolean;
  telegram_url?: string;
  github_url?: string;
  website_url?: string;
  tiktok_url?: string;
}

export interface BuilderProgress {
  status: "init" | "resolving" | "downloading" | "done" | "error";
  message: string;
  current: number;
  total: number;
  current_item?: string | null;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Операция не выполнена";
}

/** Ошибка IPC: всегда настоящий Error (со стеком), но с полем `code` как у AppError. */
export class IpcError extends Error implements AppError {
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code = "operation_failed", details?: Record<string, unknown>) {
    super(message);
    this.name = "IpcError";
    this.code = code;
    this.details = details;
  }
}

export function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(name, args).catch((error: unknown) => {
    if (error instanceof IpcError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
      const { code, message, details } = error as AppError;
      throw new IpcError(
        typeof message === "string" ? message : getErrorMessage(message),
        typeof code === "string" ? code : "operation_failed",
        details,
      );
    }
    throw new IpcError(getErrorMessage(error));
  });
}

export interface InstallPlan {
  id: string;
  instance_id: string;
  title: string;
  items: Array<{ task: InstallTask; action: "install" | "replace" | "installed" }>;
  optional: string[];
  conflicts: string[];
  warnings: string[];
}
export interface SkinPreview { data_url: string; avatar_data_url?: string; sha256: string; width: number; height: number; model?: "classic" | "slim" }
export const previewModInstall = (instanceId: string, source: string, id: string, projectType: string) =>
  command<InstallPlan>("preview_mod_install", { instanceId, source, id, projectType });
export const executeModInstall = (planId: string) => command<void>("execute_mod_install", { planId });

export const discardModInstall = (planId: string) => command<void>("discard_mod_install", { planId });

/* ---------------- Microsoft device-code login ---------------- */

export interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  device_code: string;
  interval: number;
  /** Время жизни кода в секундах (Microsoft отдаёт 900). */
  expires_in?: number;
}

export const microsoftDeviceCode = () => command<DeviceCodeInfo>("microsoft_device_code");
export const pollMicrosoftDeviceCode = (deviceCode: string) =>
  command<Account>("poll_microsoft_device_code", { deviceCode });
