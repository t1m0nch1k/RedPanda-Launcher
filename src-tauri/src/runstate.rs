//! Реестр запущенных игр, который переживает перезапуск лаунчера.
//!
//! In-memory реестр `lighty-launch` хранит PID только пока жив процесс лаунчера.
//! Если пользователь закрыл лаунчер (или он аварийно завершился), а игра продолжает
//! работать, новая сессия ничего не знает о запущенной игре: повторный запуск
//! создаёт вторую JVM с параллельной записью в `saves/`, а удаление/обновление
//! сборки ломает файлы, которые держит открытый процесс.
//!
//! Этот модуль дублирует важное в JSON-файл и при чтении проверяет, что PID
//! жив и принадлежит процессу Java (защита от повторного использования PID):
//! - запись «starting» (без PID) живёт не дольше TTL — если Java так и не
//!   стартовала, запись удаляется сама;
//! - запись с PID валидируется по имени образа процесса.

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

/// Сколько живёт запись «запуск начался, но PID ещё не известен».
/// Minecraft обычно печатает в консоль в первые секунды; если Java так и не
/// запустилась, запись устаревает и больше не блокирует операции.
const STARTING_ENTRY_TTL_SECONDS: u64 = 90;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct RunningGame {
    instance_id: String,
    #[serde(default)]
    pid: u32,
    #[serde(default)]
    spawned_at: u64,
}

lazy_static! {
    static ref RUNSTATE_MUTEX: Mutex<()> = Mutex::new(());
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

fn runstate_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not get app data dir: {e}"))?;
    fs::create_dir_all(&path).map_err(|e| format!("Could not create app data dir: {e}"))?;
    path.push("running_games.json");
    Ok(path)
}

fn load_entries_unlocked(path: &PathBuf) -> BTreeMap<String, RunningGame> {
    let Ok(text) = fs::read_to_string(path) else {
        return BTreeMap::new();
    };
    match serde_json::from_str::<Vec<RunningGame>>(&text) {
        Ok(list) => list
            .into_iter()
            .map(|entry| (entry.instance_id.clone(), entry))
            .collect(),
        Err(_) => BTreeMap::new(),
    }
}

fn save_entries_unlocked(path: &PathBuf, entries: &BTreeMap<String, RunningGame>) {
    if entries.is_empty() {
        let _ = fs::remove_file(path);
        return;
    }
    let list: Vec<&RunningGame> = entries.values().collect();
    if let Ok(text) = serde_json::to_string_pretty(&list) {
        let _ = crate::storage::atomic_write(path, text.as_bytes());
    }
}

fn upsert_entry(app: &AppHandle, instance_id: &str, pid: Option<u32>) {
    let Ok(path) = runstate_path(app) else {
        return;
    };
    let Ok(_guard) = RUNSTATE_MUTEX.lock() else {
        return;
    };
    let mut entries = load_entries_unlocked(&path);
    match entries.get_mut(instance_id) {
        Some(entry) => {
            if let Some(pid) = pid {
                entry.pid = pid;
            }
        }
        None => {
            entries.insert(
                instance_id.to_string(),
                RunningGame {
                    instance_id: instance_id.to_string(),
                    pid: pid.unwrap_or(0),
                    spawned_at: now_secs(),
                },
            );
        }
    }
    save_entries_unlocked(&path, &entries);
}

/// Регистрирует начало запуска сборки (PID ещё неизвестен).
pub fn record_game_start(app: &AppHandle, instance_id: &str) {
    upsert_entry(app, instance_id, None);
}

/// Сохраняет PID процесса игры, когда она стартовала.
pub fn record_game_pid(app: &AppHandle, instance_id: &str, pid: u32) {
    if pid == 0 {
        return;
    }
    upsert_entry(app, instance_id, Some(pid));
}

/// Убирает запись сборки из реестра (нормальный выход или отмена запуска).
pub fn record_game_exit(app: &AppHandle, instance_id: &str) {
    let Ok(path) = runstate_path(app) else {
        return;
    };
    let Ok(_guard) = RUNSTATE_MUTEX.lock() else {
        return;
    };
    let mut entries = load_entries_unlocked(&path);
    if entries.remove(instance_id).is_some() {
        save_entries_unlocked(&path, &entries);
    }
}

/// Есть ли живой процесс игры для этой сборки.
///
/// Заодно чистит мусор из реестра: устаревшие «starting» записи и записи с
/// мёртвым или переиспользованным PID.
pub fn is_instance_running(app: &AppHandle, instance_id: &str) -> bool {
    let Ok(path) = runstate_path(app) else {
        return false;
    };
    let Ok(_guard) = RUNSTATE_MUTEX.lock() else {
        return false;
    };
    let mut entries = load_entries_unlocked(&path);
    if entries.is_empty() {
        return false;
    }

    let now = now_secs();
    let mut changed = false;
    let mut target_running = false;
    let ids: Vec<String> = entries.keys().cloned().collect();
    for id in ids {
        let alive = match entries.get(&id) {
            Some(entry) if entry.pid == 0 => {
                now.saturating_sub(entry.spawned_at) <= STARTING_ENTRY_TTL_SECONDS
            }
            Some(entry) => is_process_java(entry.pid),
            None => false,
        };
        if !alive {
            if let Some(entry) = entries.get(&id) {
                log::info!(
                    "Pruning stale run entry for instance '{}' (pid={}, age={}s)",
                    id,
                    entry.pid,
                    now.saturating_sub(entry.spawned_at)
                );
            }
            entries.remove(&id);
            changed = true;
        } else if id == instance_id {
            target_running = true;
        }
    }

    if changed {
        save_entries_unlocked(&path, &entries);
    }
    target_running
}

#[cfg(windows)]
fn is_process_java(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            // Процесс мёртв (или недоступен): запись считается устаревшей.
            return false;
        }
        let mut buf = [0u16; 1024];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            buf.as_mut_ptr(),
            &mut size as *mut u32,
        );
        CloseHandle(handle);
        if ok == 0 {
            // Имя запросить не удалось, но процесс жив: перестрахуемся и
            // считаем, что игра ещё работает (не даём удалять её файлы).
            return true;
        }
        let image = String::from_utf16_lossy(&buf[..size as usize]).to_lowercase();
        image.ends_with("\\javaw.exe") || image.ends_with("\\java.exe")
    }
}

#[cfg(not(windows))]
fn is_process_java(pid: u32) -> bool {
    match fs::read_to_string(format!("/proc/{pid}/comm")) {
        Ok(comm) => matches!(comm.trim(), "java" | "javaw"),
        Err(_) => false,
    }
}

/// Отклоняющая ошибка для быстрых проверок «не ломаем запущенную игру».
pub const BUSY_INSTANCE_MESSAGE: &str =
    "Сборка запущена — дождитесь выхода из игры, прежде чем выполнять это действие.";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starting_entry_ttl_is_bounded() {
        const { assert!(STARTING_ENTRY_TTL_SECONDS >= 30) };
    }
}
