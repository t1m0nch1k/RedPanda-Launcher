use serde::Serialize;
use std::collections::BTreeMap;

/// Stable, frontend-safe error envelope used by new IPC commands.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<BTreeMap<String, String>>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_detail(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.details
            .get_or_insert_with(BTreeMap::new)
            .insert(key.into(), value.into());
        self
    }
}

pub type CommandResult<T> = Result<T, AppError>;

/// Converts legacy String errors without exposing secrets or filesystem paths.
pub fn from_legacy(error: impl AsRef<str>) -> AppError {
    let raw = error.as_ref();
    let lower = raw.to_ascii_lowercase();
    let code = if lower.contains("not found") || lower.contains("не найден") {
        "not_found"
    } else if lower.contains("checksum") || lower.contains("signature") {
        "integrity_check_failed"
    } else if lower.contains("timeout") || lower.contains("timed out") {
        "network_timeout"
    } else if lower.contains("permission") || lower.contains("доступ") {
        "permission_denied"
    } else {
        "operation_failed"
    };

    AppError::new(code, raw)
}
