// Application par défaut par type MIME : lecture + modification via xdg-mime + scan .desktop.
use serde::Serialize;
use std::fs;
use std::process::Command;

#[derive(Serialize, Clone)]
pub struct AppInfo {
    pub name: String,
    pub desktop_id: String,
    pub is_default: bool,
}

#[derive(Serialize)]
pub struct FileApps {
    pub mime: String,
    pub apps: Vec<AppInfo>,
}

// ── commandes xdg-mime ────────────────────────────────────────────────────────

fn xdg_mime(args: &[&str]) -> Option<String> {
    let out = Command::new("xdg-mime").args(args).output().ok()?;
    if !out.status.success() { return None; }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

fn get_mime(path: &str) -> String {
    xdg_mime(&["query", "filetype", path])
        .unwrap_or_else(|| "application/octet-stream".to_string())
}

fn get_default_desktop_id(mime: &str) -> Option<String> {
    xdg_mime(&["query", "default", mime])
}

// ── parsing .desktop ──────────────────────────────────────────────────────────

fn desktop_entry_field<'a>(content: &'a str, key: &str) -> Option<&'a str> {
    let mut in_entry = false;
    for line in content.lines() {
        let line = line.trim();
        if line == "[Desktop Entry]" { in_entry = true; continue; }
        if line.starts_with('[') && in_entry { break; }
        if in_entry && line.starts_with(key) && !line[key.len()..].starts_with('[') {
            let rest = line.splitn(2, '=').nth(1)?;
            return Some(rest);
        }
    }
    None
}

fn desktop_name(content: &str) -> Option<String> {
    desktop_entry_field(content, "Name=").map(|s| s.to_string())
}

fn desktop_supports_mime(content: &str, mime: &str) -> bool {
    desktop_entry_field(content, "MimeType=")
        .map(|v| v.split(';').any(|m| m.trim() == mime))
        .unwrap_or(false)
}

fn desktop_is_app(content: &str) -> bool {
    desktop_entry_field(content, "Type=")
        .map(|t| t.trim() == "Application")
        .unwrap_or(false)
}

fn desktop_hidden(content: &str) -> bool {
    desktop_entry_field(content, "NoDisplay=")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

// ── scan dossiers .desktop ────────────────────────────────────────────────────

fn app_dirs() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    vec![
        "/usr/share/applications".into(),
        "/usr/local/share/applications".into(),
        format!("{}/.local/share/applications", home),
        "/var/lib/flatpak/exports/share/applications".into(),
        format!("{}/snap/share/applications", home),
    ]
}

fn scan_apps(mime: &str, default_id: Option<&str>) -> Vec<AppInfo> {
    let mut apps: Vec<AppInfo> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for dir in app_dirs() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("desktop") { continue; }
            let Ok(content) = fs::read_to_string(&path) else { continue };
            if !desktop_is_app(&content) || desktop_hidden(&content) { continue; }
            if !desktop_supports_mime(&content, mime) { continue; }
            let Some(name) = desktop_name(&content) else { continue };
            let desktop_id = path.file_name().unwrap().to_string_lossy().to_string();
            if !seen.insert(desktop_id.clone()) { continue; }
            apps.push(AppInfo {
                is_default: default_id.map(|d| d == desktop_id).unwrap_or(false),
                name,
                desktop_id,
            });
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

// ── commandes Tauri ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_apps_for_file(path: String) -> Result<FileApps, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mime = get_mime(&path);
        let default_id = get_default_desktop_id(&mime);
        let apps = scan_apps(&mime, default_id.as_deref());
        Ok(FileApps { mime, apps })
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}

#[tauri::command]
pub fn set_default_app(desktop_id: String, mime: String) -> Result<(), String> {
    let out = Command::new("xdg-mime")
        .args(["default", &desktop_id, &mime])
        .output()
        .map_err(|e| format!("xdg-mime introuvable : {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}
