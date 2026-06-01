// Génération de miniatures d'images avec cache disque PNG (~/.cache/vela/thumbs).
use base64::Engine;
use image::imageops::FilterType;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const MAX_SOURCE_BYTES: u64 = 20 * 1024 * 1024;

fn cache_dir() -> PathBuf {
    let base = std::env::var("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_default();
            Path::new(&home).join(".cache")
        });
    base.join("vela/thumbs")
}

// Clé de cache incluant le mtime → invalidation automatique si l'image change.
fn cache_key(path: &str, mtime: u64, max: u32) -> String {
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    mtime.hash(&mut h);
    max.hash(&mut h);
    format!("{:016x}.png", h.finish())
}

fn encode(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn generate(path: &str, max: u32) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_SOURCE_BYTES {
        return Err("image trop volumineuse".into());
    }
    let mtime = meta
        .modified()
        .ok()
        .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let dir = cache_dir();
    let cache_path = dir.join(cache_key(path, mtime, max));
    if let Ok(bytes) = fs::read(&cache_path) {
        return Ok(encode(&bytes));
    }

    let img = image::open(path).map_err(|e| e.to_string())?;
    let thumb = img.resize(max, max, FilterType::Lanczos3);
    let _ = fs::create_dir_all(&dir);
    thumb
        .save_with_format(&cache_path, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let bytes = fs::read(&cache_path).map_err(|e| e.to_string())?;
    Ok(encode(&bytes))
}

// Retourne la miniature PNG (base64) d'une image, bornée à `max` px. Cache disque, skip > 20 Mo.
#[tauri::command]
pub async fn thumbnail(path: String, max: u32) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || generate(&path, max))
        .await
        .map_err(|e| e.to_string())?
}
