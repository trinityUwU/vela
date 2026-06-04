// Modèles de fichiers/dossiers (F24) : ~/.config/vela/templates/. Chaque entrée = un modèle réutilisable.
// Copie récursive simple, pur Rust, jamais d'écrasement silencieux (destination uniquifiée si collision).
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct Template {
    pub name: String,
    pub is_dir: bool,
}

fn templates_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".config").join("vela").join("templates")
}

#[tauri::command]
pub fn template_list() -> Result<Vec<Template>, String> {
    let dir = templates_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let is_dir = entry.path().is_dir();
        out.push(Template { name, is_dir });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

// Renvoie un chemin libre : `base`, sinon `base (1)`, `base (2)`…
fn unique_path(dest: &Path) -> PathBuf {
    if !dest.exists() {
        return dest.to_path_buf();
    }
    let parent = dest.parent().unwrap_or(Path::new("."));
    let stem = dest.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = dest.extension().map(|s| format!(".{}", s.to_string_lossy())).unwrap_or_default();
    for i in 1..10000 {
        let candidate = parent.join(format!("{stem} ({i}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    dest.to_path_buf()
}

fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
    } else {
        if let Some(p) = dst.parent() {
            fs::create_dir_all(p)?;
        }
        fs::copy(src, dst)?;
    }
    Ok(())
}

// Instancie un modèle dans `dest_dir` sous `new_name` (ou le nom du modèle). Jamais d'écrasement.
#[tauri::command]
pub fn template_instantiate(name: String, dest_dir: String, new_name: String) -> Result<String, String> {
    let src = templates_dir().join(&name);
    if !src.exists() {
        return Err(format!("modèle introuvable : {name}"));
    }
    let target_name = if new_name.trim().is_empty() { name.clone() } else { new_name };
    let dst = unique_path(&Path::new(&dest_dir).join(&target_name));
    copy_recursive(&src, &dst).map_err(|e| {
        eprintln!("[template_instantiate] {name} -> {dest_dir}: {e}");
        e.to_string()
    })?;
    Ok(dst.to_string_lossy().to_string())
}

// Enregistre un fichier/dossier existant comme modèle réutilisable.
#[tauri::command]
pub fn save_as_template(path: String, name: String) -> Result<(), String> {
    let dir = templates_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let src = Path::new(&path);
    let target = if name.trim().is_empty() {
        src.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default()
    } else {
        name
    };
    let dst = unique_path(&dir.join(&target));
    copy_recursive(src, &dst).map_err(|e| {
        eprintln!("[save_as_template] {path}: {e}");
        e.to_string()
    })
}
