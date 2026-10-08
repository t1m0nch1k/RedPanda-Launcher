use super::resolver::{resolve_dependencies, InstallTask};
use crate::modrinth::ModrinthVersion;
use serde::Serialize;
use sha1::{Digest, Sha1};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    io::Read,
    path::Path,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct PlanItem {
    pub task: InstallTask,
    pub action: String,
}
#[derive(Clone, Serialize)]
pub struct InstallPlan {
    pub id: String,
    pub instance_id: String,
    pub title: String,
    pub items: Vec<PlanItem>,
    pub optional: Vec<String>,
    pub conflicts: Vec<String>,
    pub warnings: Vec<String>,
}
struct StoredPlan {
    plan: InstallPlan,
    snapshot: BTreeMap<String, String>,
    game_version: String,
    loader: String,
    kind: String,
    created: Instant,
}
lazy_static::lazy_static! {
    static ref PLANS: Mutex<HashMap<String, StoredPlan>> = Mutex::new(HashMap::new());
    static ref INSTALLING: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
}
const PLAN_TTL: Duration = Duration::from_secs(600);
pub fn content_folder(kind: &str) -> Result<&'static str, String> {
    match kind {
        "mod" => Ok("mods"),
        "resourcepack" => Ok("resourcepacks"),
        "shader" => Ok("shaderpacks"),
        _ => Err("Неизвестный тип контента".into()),
    }
}
fn snapshot(folder: &Path) -> Result<BTreeMap<String, String>, String> {
    let mut result = BTreeMap::new();
    if !folder.exists() {
        return Ok(result);
    }
    for entry in fs::read_dir(folder).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let path = crate::security::safe_join(folder, &name)?;
        let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
        let mut hasher = Sha1::new();
        let mut buffer = [0u8; 65536];
        loop {
            let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        result.insert(name, hex::encode(hasher.finalize()));
    }
    Ok(result)
}
fn classify(task: &InstallTask, files: &BTreeMap<String, String>) -> &'static str {
    if task.sha1.as_ref().is_some_and(|hash| {
        files.iter().any(|(name, h)| {
            Path::new(name).extension() == Path::new(&task.filename).extension()
                && h.eq_ignore_ascii_case(hash)
        })
    }) {
        "installed"
    } else if files.contains_key(&task.filename) {
        "replace"
    } else {
        "install"
    }
}

pub async fn preview(
    app: AppHandle,
    instance_id: String,
    source: String,
    id: String,
    kind: String,
) -> Result<InstallPlan, String> {
    let folder_name = content_folder(&kind)?;
    let instance = crate::instances::get_instances(app.clone())
        .await?
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or("Сборка не найдена")?;
    let folder =
        crate::security::safe_join(&crate::security::instance_dir(&instance_id)?, folder_name)?;
    let snapshot_folder = folder.clone();
    let files = tauri::async_runtime::spawn_blocking(move || snapshot(&snapshot_folder))
        .await
        .map_err(|e| e.to_string())??;
    let tasks = resolve_dependencies(
        app.clone(),
        instance_id.clone(),
        source,
        id,
        instance.game_version.clone(),
        instance.loader_type.clone(),
    )
    .await?;
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/install-plan")?;
    let mut optional = Vec::new();
    let mut conflicts = Vec::new();
    let mut warnings = Vec::new();
    // Identify local files through the provider's published hashes. Unknown files remain explicit.
    let mut installed: HashMap<String, ModrinthVersion> = HashMap::new();
    if kind == "mod" && !files.is_empty() {
        let response = client.post("https://api.modrinth.com/v2/version_files").json(&serde_json::json!({"hashes": files.iter().filter(|(name,_)| name.ends_with(".jar")).map(|(_,hash)| hash).collect::<Vec<_>>(), "algorithm":"sha1"})).send().await;
        match response {
            Ok(res) if res.status().is_success() => {
                installed = res.json().await.map_err(|e| e.to_string())?;
            }
            _ => warnings.push(
                "Не удалось распознать установленные моды: проверка конфликтов неполная".into(),
            ),
        }
        let unknown = files
            .iter()
            .filter(|(name, hash)| name.ends_with(".jar") && !installed.contains_key(*hash))
            .count();
        if unknown > 0 {
            warnings.push(format!(
                "Не распознано файлов: {unknown}. Их совместимость автоматически не проверена"
            ));
        }
    }
    let mut planned_versions: HashMap<String, ModrinthVersion> = HashMap::new();
    let mut items = Vec::new();
    let mut filenames = HashSet::new();
    for task in tasks {
        crate::security::validate_filename(&task.filename)?;
        if !filenames.insert(task.filename.to_lowercase()) {
            return Err(format!(
                "Два проекта используют имя файла {}",
                task.filename
            ));
        }
        let hash = task
            .sha1
            .as_deref()
            .ok_or_else(|| format!("У {} отсутствует SHA-1", task.name))?;
        if hash.len() != 40 || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("Некорректный SHA-1 файла".into());
        }
        let trusted = match task.source.as_str() {
            "modrinth" => crate::modrinth::is_trusted_download_url(&task.url),
            "curseforge" => crate::curseforge::is_trusted_download_url(&task.url),
            _ => false,
        };
        if !trusted {
            return Err(format!(
                "{} недоступен для безопасной загрузки. Скачайте файл с сайта автора",
                task.name
            ));
        }
        let action = classify(&task, &files).to_string();
        if task.source == "modrinth" && kind == "mod" {
            let version: ModrinthVersion = client
                .get(format!("https://api.modrinth.com/v2/version/{}", task.id))
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            if !version.loaders.as_ref().is_some_and(|loaders| {
                loaders
                    .iter()
                    .any(|l| l.eq_ignore_ascii_case(&instance.loader_type))
            }) {
                conflicts.push(format!(
                    "{} не поддерживает загрузчик {}",
                    task.name, instance.loader_type
                ));
            }
            for dep in version.dependencies.as_deref().unwrap_or_default() {
                if dep.dependency_type == "optional" {
                    optional.push(
                        dep.project_id
                            .clone()
                            .or(dep.version_id.clone())
                            .unwrap_or_else(|| "Необязательная зависимость".into()),
                    );
                }
                if dep.dependency_type == "incompatible"
                    && installed
                        .values()
                        .any(|v| dependency_matches(&dep.project_id, &dep.version_id, v))
                {
                    conflicts.push(format!(
                        "{} конфликтует с установленным модом {}",
                        task.name,
                        dep.project_id
                            .clone()
                            .or(dep.version_id.clone())
                            .unwrap_or_default()
                    ));
                }
            }
            planned_versions.insert(task.id.clone(), version.clone());
            for (name, hash) in &files {
                if !name.ends_with(".jar") {
                    continue;
                }
                if let Some(local) = installed.get(hash) {
                    if local.project_id.as_deref() == Some(&task.project_id)
                        && name != &task.filename
                        && action != "installed"
                    {
                        conflicts.push(format!("Уже установлена другая версия {} ({name}). Удалите её перед установкой", task.name));
                    }
                    for dep in local.dependencies.as_deref().unwrap_or_default() {
                        if dep.dependency_type == "incompatible"
                            && dependency_matches(&dep.project_id, &dep.version_id, &version)
                        {
                            conflicts.push(format!("{name} несовместим с {}", task.name));
                        }
                    }
                }
            }
        }
        if task.source == "curseforge" && kind == "mod" {
            #[derive(serde::Deserialize)]
            struct FilesResponse {
                data: Vec<crate::curseforge::CurseForgeFile>,
            }
            let response = crate::curseforge::send_curseforge_request(&app,&client,reqwest::Method::POST,"https://api.curseforge.com/v1/mods/files",Some(&serde_json::json!({"fileIds":[task.id.parse::<u32>().map_err(|_| "Некорректный ID файла")?]}))).await?;
            let response: FilesResponse = response.json().await.map_err(|e| e.to_string())?;
            for file in response.data {
                for dep in file.dependencies.unwrap_or_default() {
                    if dep.relation_type == 2 {
                        optional.push(format!("CurseForge #{}", dep.mod_id));
                    }
                }
            }
        }
        if task.source == "curseforge" && kind == "mod" {
            warnings.push("Полная проверка конфликтов CurseForge пока недоступна; обязательные зависимости включены".into());
        }
        items.push(PlanItem { task, action });
    }
    // Check conflicts declared between new files too, not only with existing files.
    if kind == "mod" {
        for item in &items {
            if item.task.source != "modrinth" {
                continue;
            }
            let version = planned_versions
                .get(&item.task.id)
                .ok_or("Метаданные плана недоступны")?;
            for dep in version
                .dependencies
                .as_deref()
                .unwrap_or_default()
                .iter()
                .filter(|d| d.dependency_type == "incompatible")
            {
                if items.iter().any(|other| {
                    other.task.source == "modrinth"
                        && dep
                            .project_id
                            .as_ref()
                            .is_none_or(|p| p == &other.task.project_id)
                        && dep.version_id.as_ref().is_none_or(|v| v == &other.task.id)
                        && (dep.project_id.is_some() || dep.version_id.is_some())
                }) {
                    conflicts.push(format!(
                        "{} несовместим с файлом в плане установки",
                        item.task.name
                    ));
                }
            }
        }
    }
    optional.sort();
    optional.dedup();
    conflicts.sort();
    conflicts.dedup();
    warnings.sort();
    warnings.dedup();
    let plan = InstallPlan {
        id: uuid::Uuid::new_v4().to_string(),
        instance_id,
        title: items
            .last()
            .map(|i| i.task.name.clone())
            .unwrap_or_default(),
        items,
        optional,
        conflicts,
        warnings,
    };
    let mut plans = PLANS.lock().map_err(|_| "Не удалось сохранить план")?;
    plans.retain(|_, p| p.created.elapsed() < PLAN_TTL);
    if plans.len() >= 32 {
        return Err("Закройте старые предпросмотры или повторите через несколько минут".into());
    }
    plans.insert(
        plan.id.clone(),
        StoredPlan {
            plan: plan.clone(),
            snapshot: files,
            game_version: instance.game_version,
            loader: instance.loader_type,
            kind,
            created: Instant::now(),
        },
    );
    Ok(plan)
}
fn dependency_matches(
    project: &Option<String>,
    version: &Option<String>,
    candidate: &ModrinthVersion,
) -> bool {
    (project.is_some() || version.is_some())
        && project
            .as_ref()
            .is_none_or(|p| candidate.project_id.as_ref() == Some(p))
        && version.as_ref().is_none_or(|v| &candidate.id == v)
}
struct InstallGuard(String);
impl Drop for InstallGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = INSTALLING.lock() {
            active.remove(&self.0);
        }
    }
}
#[derive(Clone, Serialize)]
struct Progress {
    plan_id: String,
    current: usize,
    total: usize,
    filename: String,
}
pub fn discard(plan_id: &str) -> Result<(), String> {
    PLANS
        .lock()
        .map_err(|_| "Не удалось закрыть план")?
        .remove(plan_id);
    Ok(())
}
pub async fn execute(app: AppHandle, plan_id: String) -> Result<(), String> {
    let stored = PLANS
        .lock()
        .map_err(|_| "Не удалось открыть план")?
        .remove(&plan_id)
        .ok_or("План устарел. Откройте предпросмотр ещё раз")?;
    let kind = stored.kind.clone();
    if stored.created.elapsed() >= PLAN_TTL {
        return Err("План устарел. Откройте предпросмотр ещё раз".into());
    }
    if !stored.plan.conflicts.is_empty() {
        return Err("Сначала устраните конфликты сборки".into());
    }
    {
        let mut active = INSTALLING
            .lock()
            .map_err(|_| "Ошибка блокировки установки")?;
        if !active.insert(stored.plan.instance_id.clone()) {
            return Err("В этой сборке уже идёт установка".into());
        }
    }
    let _guard = InstallGuard(stored.plan.instance_id.clone());
    let instance = crate::instances::get_instances(app.clone())
        .await?
        .into_iter()
        .find(|i| i.id == stored.plan.instance_id)
        .ok_or("Сборка удалена")?;
    if instance.game_version != stored.game_version || instance.loader_type != stored.loader {
        return Err("Настройки сборки изменились. Откройте предпросмотр ещё раз".into());
    }
    let folder = crate::security::safe_join(
        &crate::security::instance_dir(&instance.id)?,
        content_folder(&kind)?,
    )?;
    let check_folder = folder.clone();
    let current = tauri::async_runtime::spawn_blocking(move || snapshot(&check_folder))
        .await
        .map_err(|e| e.to_string())??;
    if current != stored.snapshot {
        return Err("Файлы сборки изменились. Откройте предпросмотр ещё раз".into());
    }
    let client = crate::downloads::trusted_download_client("RedPandaLauncher/install-plan")?;
    let staging = tempfile::tempdir().map_err(|e| e.to_string())?;
    let downloads: Vec<_> = stored
        .plan
        .items
        .iter()
        .filter(|i| i.action != "installed")
        .collect();
    for (index, item) in downloads.iter().enumerate() {
        let _ = app.emit(
            "mod-install-progress",
            Progress {
                plan_id: plan_id.clone(),
                current: index,
                total: downloads.len(),
                filename: item.task.filename.clone(),
            },
        );
        let dest = crate::security::safe_join(staging.path(), &item.task.filename)?;
        crate::downloads::download_to_file_with_sha1(
            &client,
            &item.task.url,
            &dest,
            item.task.sha1.as_deref().ok_or("Нет SHA-1")?,
        )
        .await?;
    }
    // Revalidate after network I/O, before committing any file.
    let check_folder = folder.clone();
    let current = tauri::async_runtime::spawn_blocking(move || snapshot(&check_folder))
        .await
        .map_err(|e| e.to_string())??;
    if current != stored.snapshot {
        return Err("Файлы сборки изменились во время загрузки; установка отменена".into());
    }
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let originals = tempfile::tempdir().map_err(|e| e.to_string())?;
    for item in &downloads {
        if stored.snapshot.contains_key(&item.task.filename) {
            fs::copy(
                crate::security::safe_join(&folder, &item.task.filename)?,
                originals.path().join(&item.task.filename),
            )
            .map_err(|e| e.to_string())?;
        }
    }
    let mut committed: Vec<String> = Vec::new();
    for item in &downloads {
        let dest = crate::security::safe_join(&folder, &item.task.filename)?;
        let bytes =
            fs::read(staging.path().join(&item.task.filename)).map_err(|e| e.to_string())?;
        if let Err(error) = crate::storage::atomic_write(&dest, &bytes) {
            for name in committed.iter().rev() {
                let target = folder.join(name);
                if stored.snapshot.contains_key(name) {
                    let _ = fs::copy(originals.path().join(name), &target);
                } else {
                    let _ = fs::remove_file(target);
                }
            }
            return Err(error);
        }
        committed.push(item.task.filename.clone());
    }
    let _ = app.emit(
        "mod-install-progress",
        Progress {
            plan_id,
            current: downloads.len(),
            total: downloads.len(),
            filename: String::new(),
        },
    );
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn task() -> InstallTask {
        InstallTask {
            id: "v".into(),
            project_id: "p".into(),
            name: "mod".into(),
            url: String::new(),
            filename: "mod.jar".into(),
            source: "modrinth".into(),
            warning: None,
            sha1: Some("abc".into()),
        }
    }
    #[test]
    fn exact_hash_skips_renamed_file() {
        let files = BTreeMap::from([("renamed.jar".into(), "ABC".into())]);
        assert_eq!(classify(&task(), &files), "installed");
    }
    #[test]
    fn same_name_different_hash_replaces() {
        let files = BTreeMap::from([("mod.jar".into(), "def".into())]);
        assert_eq!(classify(&task(), &files), "replace");
    }
    #[test]
    fn empty_folder_installs() {
        assert_eq!(classify(&task(), &BTreeMap::new()), "install");
    }
    #[test]
    fn invalid_content_kind_rejected() {
        assert!(content_folder("../saves").is_err());
    }
    #[test]
    fn backup_or_disabled_file_is_not_installed() {
        let files = BTreeMap::from([
            ("mod.jar.bak".into(), "abc".into()),
            ("mod.jar.disabled".into(), "abc".into()),
        ]);
        assert_eq!(classify(&task(), &files), "install");
    }
}
