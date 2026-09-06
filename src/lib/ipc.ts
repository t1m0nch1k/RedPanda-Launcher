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
  curseforge_api_key: string;
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

export function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(name, args).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
      throw error;
    }
    throw {
      code: "operation_failed",
      message: getErrorMessage(error),
    } satisfies AppError;
  });
}
