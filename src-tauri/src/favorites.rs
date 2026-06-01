// Favoris persistés dans ~/.config/vela/favorites.json
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct FavPin {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FavGroup {
    pub name: String,
    pub pins: Vec<FavPin>,
    pub collapsed: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Favorites {
    pub pins: Vec<FavPin>,
    pub groups: Vec<FavGroup>,
}

fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".config").join("vela").join("favorites.json")
}

#[tauri::command]
pub fn load_favorites() -> Favorites {
    let p = config_path();
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn save_favorites(favorites: Favorites) -> Result<(), String> {
    let p = config_path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&favorites).map_err(|e| e.to_string())?;
    fs::write(&p, json).map_err(|e| e.to_string())
}
