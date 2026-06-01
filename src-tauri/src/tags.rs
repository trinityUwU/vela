// Étiquettes couleur par fichier, persistées dans ~/.config/vela/tags.json (path → clé couleur).
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

type TagMap = HashMap<String, String>;

fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".config").join("vela").join("tags.json")
}

fn read_map() -> TagMap {
    fs::read_to_string(config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_map(map: &TagMap) -> Result<(), String> {
    let p = config_path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    fs::write(&p, json).map_err(|e| {
        eprintln!("[write_map tags] {}: {e}", p.display());
        e.to_string()
    })
}

// Retourne la table complète des étiquettes (path → clé couleur).
#[tauri::command]
pub fn load_tags() -> TagMap {
    read_map()
}

// Définit (ou retire si `color` est vide) l'étiquette couleur de plusieurs chemins.
#[tauri::command]
pub fn set_tag(paths: Vec<String>, color: String) -> Result<(), String> {
    let mut map = read_map();
    for path in &paths {
        if color.is_empty() {
            map.remove(path);
        } else {
            map.insert(path.clone(), color.clone());
        }
    }
    write_map(&map)
}
