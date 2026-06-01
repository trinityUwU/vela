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
    for (label, sub) in [
        ("Bureau", "Desktop"),
        ("Documents", "Documents"),
        ("Téléchargements", "Downloads"),
        ("Images", "Pictures"),
        ("Musique", "Music"),
        ("Vidéos", "Videos"),
    ] {
        let p = Path::new(&home).join(sub);
        if p.is_dir() {
            places.push(Place {
                name: label.into(),
                path: p.to_string_lossy().to_string(),
                kind: "dir".into(),
            });
        }
    }
    places.extend(read_mounts());
    Ok(places)
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
