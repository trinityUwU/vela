// Profils de layout persistés dans ~/.config/vela/profiles.json
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum PanelId {
    Sidebar,
    Listing,
    Editor,
    Filetree,
    Terminal,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Zones {
    pub left: Option<PanelId>,
    pub center: PanelId,
    pub right: Option<PanelId>,
    pub bottom: Option<PanelId>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub zones: Zones,
    pub filter_bar_hidden: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProfilesState {
    pub active: String,
    pub profiles: Vec<Profile>,
}

impl Default for ProfilesState {
    fn default() -> Self {
        default_profiles()
    }
}

fn default_profiles() -> ProfilesState {
    ProfilesState {
        active: "explorateur".into(),
        profiles: vec![
            Profile {
                id: "explorateur".into(),
                name: "Explorateur".into(),
                zones: Zones {
                    left: Some(PanelId::Sidebar),
                    center: PanelId::Listing,
                    right: None,
                    bottom: None,
                },
                filter_bar_hidden: false,
            },
            Profile {
                id: "edition".into(),
                name: "Édition".into(),
                zones: Zones {
                    left: Some(PanelId::Sidebar),
                    center: PanelId::Listing,
                    right: Some(PanelId::Editor),
                    bottom: None,
                },
                filter_bar_hidden: false,
            },
        ],
    }
}

fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".config").join("vela").join("profiles.json")
}

#[tauri::command]
pub fn load_profiles() -> ProfilesState {
    let p = config_path();
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn save_profiles(profiles: ProfilesState) -> Result<(), String> {
    let p = config_path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&profiles).map_err(|e| e.to_string())?;
    fs::write(&p, json).map_err(|e| e.to_string())
}
