use crate::types::version_metadata::{ Library, MainClass, Arguments, Version, VersionMetaData};
use crate::types::VersionInfo;
use lighty_core::QueryError;
use crate::utils::{query::Query, manifest::ManifestRepository};
use crate::utils::maven::{fetch_file_size, fetch_maven_sha1};
use crate::loaders::vanilla::{vanilla::VanillaQuery};
use once_cell::sync::Lazy;
use super::fabric_metadata::FabricMetaData;
use async_trait::async_trait;
use lighty_core::hosts::HTTP_CLIENT as CLIENT;
use futures::future::join_all;
use std::collections::HashMap;

/// FabricMC metadata server (returns the `profile/json` manifest).
const FABRIC_META: &str = "https://meta.fabricmc.net/v2/versions/loader";
/// Default Maven repository when a library entry omits `url`.
const FABRIC_MAVEN: &str = "https://maven.fabricmc.net/";

pub type Result<T> = std::result::Result<T, QueryError>;

/// Shared cached repository for Fabric manifests.
pub static FABRIC: Lazy<ManifestRepository<FabricQuery>> = Lazy::new(|| ManifestRepository::new());

/// Sub-queries supported by the Fabric loader.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum FabricQuery {
    Libraries,
    Arguments,
    MainClass,
    FabricBuilder,
}

#[async_trait]
impl Query for FabricQuery {
    type Query = FabricQuery;
    type Data = VersionMetaData;
    type Raw = FabricMetaData;

    fn name() -> &'static str {
        "fabric"
    }

    async fn fetch_full_data<V: VersionInfo>(version: &V) -> Result<FabricMetaData> {
        let meta_dir = version.game_dirs().join(".metadata");
        let cache_file = meta_dir.join(format!(
            "fabric_{}_{}.json",
            version.minecraft_version(),
            version.loader_version()
        ));

        let is_offline = std::env::var("REDPANDA_OFFLINE_MODE").map(|v| v == "1").unwrap_or(false);
        if is_offline && cache_file.exists() {
            if let Ok(content) = std::fs::read_to_string(&cache_file) {
                if let Ok(cached_meta) = serde_json::from_str::<FabricMetaData>(&content) {
                    lighty_core::trace_info!("Offline mode: using cached Fabric metadata from {:?}", cache_file);
                    return Ok(cached_meta);
                }
            }
        }

        let urls = [
            format!(
                "{}/{}/{}/profile/json",
                FABRIC_META,
                version.minecraft_version(),
                version.loader_version()
            ),
            format!(
                "https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/{}/{}/profile/json",
                version.minecraft_version(),
                version.loader_version()
            ),
        ];

        let mut last_err = None;
        for manifest_url in urls {
            lighty_core::trace_debug!(url = %manifest_url, loader = "fabric", "Fetching manifest");
            match CLIENT.get(&manifest_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    match resp.json::<FabricMetaData>().await {
                        Ok(manifest) => {
                            if let Ok(json_str) = serde_json::to_string(&manifest) {
                                let _ = std::fs::create_dir_all(&meta_dir);
                                let _ = std::fs::write(&cache_file, json_str);
                            }
                            return Ok(manifest);
                        }
                        Err(e) => {
                            last_err = Some(QueryError::Network(e));
                        }
                    }
                }
                Ok(resp) => {
                    lighty_core::trace_warn!("HTTP {} from {}", resp.status(), manifest_url);
                }
                Err(e) => {
                    lighty_core::trace_warn!("Network error connecting to {}: {}", manifest_url, e);
                    last_err = Some(QueryError::Network(e));
                }
            }
        }

        if cache_file.exists() {
            if let Ok(content) = std::fs::read_to_string(&cache_file) {
                if let Ok(cached_meta) = serde_json::from_str::<FabricMetaData>(&content) {
                    lighty_core::trace_info!("Using cached Fabric metadata from {:?}", cache_file);
                    return Ok(cached_meta);
                }
            }
        }

        Err(last_err.unwrap_or_else(|| QueryError::Conversion {
            message: format!(
                "Failed to fetch Fabric manifest for {} {}",
                version.minecraft_version(),
                version.loader_version()
            ),
        }))
    }

    async fn extract<V: VersionInfo>(version: &V, query: &Self::Query, full_data: &FabricMetaData) -> Result<Self::Data> {
        let result = match query {
            FabricQuery::Libraries => VersionMetaData::Libraries(extract_libraries(full_data).await?),
            FabricQuery::Arguments => VersionMetaData::Arguments(extract_arguments(full_data)),
            FabricQuery::MainClass => VersionMetaData::MainClass(extract_main_class(full_data)),
            FabricQuery::FabricBuilder => VersionMetaData::Version(Self::version_builder(version, full_data).await?),
        };
        Ok(result)
    }

    async fn version_builder<V: VersionInfo>(version: &V, full_data: &FabricMetaData) -> Result<Version> {
        let (vanilla_builder, fabric_libraries) = tokio::try_join!(
        async {
            let vanilla_data = VanillaQuery::fetch_full_data(version).await?;
            VanillaQuery::version_builder(version, &vanilla_data).await
        },
        extract_libraries(full_data)
    )?;

        Ok(Version {
            main_class: merge_main_class(vanilla_builder.main_class, extract_main_class(full_data)),
            java_version: vanilla_builder.java_version,
            arguments: merge_arguments(vanilla_builder.arguments, extract_arguments(full_data)),
            libraries: merge_libraries(vanilla_builder.libraries, fabric_libraries),
            mods: None,
            natives: vanilla_builder.natives,
            client: vanilla_builder.client,
            assets_index: vanilla_builder.assets_index,
            assets: vanilla_builder.assets,
        })
    }
}

fn merge_main_class(vanilla: MainClass, fabric: MainClass) -> MainClass {
    if fabric.main_class.is_empty() {
        vanilla
    } else {
        fabric
    }
}

fn merge_arguments(vanilla: Arguments, fabric: Arguments) -> Arguments {
    Arguments {
        game: {
            let mut args = vanilla.game;
            args.extend(fabric.game);
            args
        },

        jvm: match (vanilla.jvm, fabric.jvm) {
            (Some(mut v), Some(f)) => {
                v.extend(f);
                Some(v)
            }
            (Some(v), None) => Some(v),
            (None, Some(f)) => Some(f),
            (None, None) => None,
        },

    }
}

/// Merges library lists, de-duplicating by `group:artifact`. Fabric wins.
fn merge_libraries(vanilla_libs: Vec<Library>, fabric_libs: Vec<Library>) -> Vec<Library> {
    let capacity = vanilla_libs.len() + fabric_libs.len();
    let mut lib_map: HashMap<String, Library> = HashMap::with_capacity(capacity);

    for lib in vanilla_libs {
        let key = extract_artifact_key(&lib.name);
        lib_map.insert(key, lib);
    }

    for lib in fabric_libs {
        let key = extract_artifact_key(&lib.name);
        lib_map.insert(key, lib);
    }

    lib_map.into_values().collect()
}

fn extract_artifact_key(maven_name: &str) -> String {
    let mut parts = maven_name.split(':');
    match (parts.next(), parts.next()) {
        (Some(group), Some(artifact)) => format!("{}:{}", group, artifact),
        _ => maven_name.to_string(),
    }
}

/// Parallel-fetch implementation; returns `Result` for `tokio::try_join!`.
async fn extract_libraries(full_data: &FabricMetaData) -> Result<Vec<Library>> {
    let futures = full_data.libraries.iter().map(|lib| {
        let lib_name = lib.name.clone();
        let lib_url = lib.url.clone();
        let lib_sha1 = lib.sha1.clone();
        let lib_size = lib.size;

        async move {
            let base_url = lib_url.as_deref().unwrap_or(FABRIC_MAVEN);
            let (path, full_url) = maven_artifact_to_path_and_url(&lib_name, base_url);

            // Only hit Maven for SHA1/size when the manifest didn't supply them.
            let (sha1, size) = if lib_sha1.is_none() || lib_size.is_none() {
                tokio::join!(
                    async {
                        if lib_sha1.is_none() {
                            fetch_maven_sha1(&full_url).await
                        } else {
                            lib_sha1.clone()
                        }
                    },
                    async {
                        if lib_size.is_none() {
                            fetch_file_size(&full_url).await
                        } else {
                            lib_size
                        }
                    }
                )
            } else {
                (lib_sha1, lib_size)
            };

            Library {
                name: lib_name,
                url: Some(full_url),
                path: Some(path),
                sha1,
                size,
            }
        }
    });

    Ok(join_all(futures).await)
}

fn maven_artifact_to_path_and_url(maven_name: &str, base_url: &str) -> (String, String) {
    let mut parts = maven_name.split(':');

    let (group_id, artifact_id, version) = match (parts.next(), parts.next(), parts.next()) {
        (Some(g), Some(a), Some(v)) => (g, a, v),
        _ => return (String::new(), String::new()),
    };

    let group_path = group_id.replace('.', "/");
    let jar_name = format!("{}-{}.jar", artifact_id, version);
    let path = format!("{}/{}/{}/{}", group_path, artifact_id, version, jar_name);
    let base = base_url.trim_end_matches('/');
    let full_url = format!("{}/{}", base, path);

    (path, full_url)
}

fn extract_arguments(full_data: &FabricMetaData) -> Arguments {
    Arguments {
        game: full_data.arguments.game.clone(),
        jvm: Some(full_data.arguments.jvm.clone()),
    }
}

fn extract_main_class(full_data: &FabricMetaData) -> MainClass {
    MainClass {
        main_class: full_data.main_class.clone(),
    }
}