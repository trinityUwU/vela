// Raccourcis de la sidebar : dossier home, dossiers XDG usuels, points de montage réels.
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct Place {
    pub name: String,
    pub path: String,
    pub kind: String, // "home" | "dir" | "mount"
}

#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    std::env::var("HOME").map_err(|e| {
        eprintln!("[home_dir] {e}");
        e.to_string()
    })
}

#[tauri::command]
pub fn list_places() -> Result<Vec<Place>, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let mut places = vec![Place {
        name: "Accueil".into(),
        path: home.clone(),
        kind: "home".into(),
    }];
    let xdg = read_user_dirs(&home);
    // (label FR, clé user-dirs.dirs, noms de dossier candidats EN/FR) — on prend le 1er existant.
    for (label, xdg_key, candidates) in [
        ("Bureau", "XDG_DESKTOP_DIR", &["Desktop", "Bureau"][..]),
        ("Documents", "XDG_DOCUMENTS_DIR", &["Documents"][..]),
        ("Téléchargements", "XDG_DOWNLOAD_DIR", &["Downloads", "Téléchargements"][..]),
        ("Images", "XDG_PICTURES_DIR", &["Pictures", "Images"][..]),
        ("Musique", "XDG_MUSIC_DIR", &["Music", "Musique", "Musiques"][..]),
        ("Vidéos", "XDG_VIDEOS_DIR", &["Videos", "Vidéos"][..]),
    ] {
        if let Some(path) = resolve_user_dir(&home, &xdg, xdg_key, candidates) {
            places.push(Place { name: label.into(), path, kind: "dir".into() });
        }
    }
    places.extend(read_mounts());
    Ok(places)
}

/// Parse ~/.config/user-dirs.dirs → map clé XDG → chemin absolu (les "$HOME" sont résolus).
fn read_user_dirs(home: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let path = Path::new(home).join(".config/user-dirs.dirs");
    let Ok(content) = fs::read_to_string(&path) else { return map; };
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') { continue; }
        let Some((key, val)) = line.split_once('=') else { continue; };
        let val = val.trim().trim_matches('"').replace("$HOME", home);
        map.insert(key.trim().to_string(), val);
    }
    map
}

/// Résout un dossier XDG : valeur de user-dirs.dirs si le dossier existe, sinon 1er candidat existant.
fn resolve_user_dir(
    home: &str,
    xdg: &std::collections::HashMap<String, String>,
    key: &str,
    candidates: &[&str],
) -> Option<String> {
    if let Some(v) = xdg.get(key) {
        if Path::new(v).is_dir() {
            return Some(v.clone());
        }
    }
    candidates.iter().map(|c| Path::new(home).join(c)).find(|p| p.is_dir())
        .map(|p| p.to_string_lossy().to_string())
}

fn read_mounts() -> Vec<Place> {
    let content = match fs::read_to_string("/proc/mounts") {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[read_mounts] {e}");
            return Vec::new();
        }
    };
    content
        .lines()
        .filter_map(parse_mount_line)
        .collect()
}

fn parse_mount_line(line: &str) -> Option<Place> {
    let mut cols = line.split_whitespace();
    let _dev = cols.next()?;
    let mountpoint = cols.next()?.replace("\\040", " ");
    let keep = mountpoint.starts_with("/mnt")
        || mountpoint.starts_with("/media")
        || mountpoint.starts_with("/run/media");
    if !keep {
        return None;
    }
    let name = Path::new(&mountpoint)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| mountpoint.clone());
    Some(Place {
        name,
        path: mountpoint,
        kind: "mount".into(),
    })
}
