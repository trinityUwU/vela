// Surveillance live du dossier courant : émet « fs-changed » quand son contenu change.
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub struct DirWatcher {
    inner: Mutex<Option<(RecommendedWatcher, String)>>,
}

impl DirWatcher {
    pub fn new() -> Self {
        Self { inner: Mutex::new(None) }
    }
}

// Surveille `path` (non récursif). Remplace toute surveillance précédente.
#[tauri::command]
pub fn watch_dir(app: AppHandle, state: tauri::State<DirWatcher>, path: String) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some((_, current)) = guard.as_ref() {
        if current == &path {
            return Ok(());
        }
    }
    let app_handle = app.clone();
    let watched = path.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if res.is_ok() {
            let _ = app_handle.emit("fs-changed", &watched);
        }
    })
    .map_err(|e| {
        eprintln!("[watch_dir] {path}: {e}");
        e.to_string()
    })?;
    watcher
        .watch(Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| {
            eprintln!("[watch_dir] watch {path}: {e}");
            e.to_string()
        })?;
    *guard = Some((watcher, path));
    Ok(())
}
