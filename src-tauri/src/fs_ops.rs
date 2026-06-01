// Opérations filesystem exposées au front : listing, lecture, écriture, CRUD entrées.
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
}

#[derive(Serialize)]
pub struct DirListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<DirEntry>,
}

fn compound_extension(name: &str) -> String {
    let lower = name.to_lowercase();
    const COMPOUNDS: &[&str] = &["tar.gz", "tar.bz2", "tar.xz", "tar.zst", "tar.lz4"];
    for c in COMPOUNDS {
        if lower.ends_with(&format!(".{c}")) {
            return c.to_string();
        }
    }
    Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn to_entry(path: &Path) -> Option<DirEntry> {
    let meta = fs::symlink_metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let extension = compound_extension(&name);
    Some(DirEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir: meta.is_dir(),
        size: meta.len(),
        modified,
        extension,
    })
}

#[tauri::command]
pub fn list_dir(path: String, show_hidden: bool) -> Result<DirListing, String> {
    let dir = Path::new(&path);
    let read = fs::read_dir(dir).map_err(|e| {
        eprintln!("[list_dir] {path}: {e}");
        e.to_string()
    })?;
    let mut entries: Vec<DirEntry> = read
        .filter_map(|r| r.ok())
        .map(|e| e.path())
        .filter(|p| show_hidden || !is_hidden(p))
        .filter_map(|p| to_entry(&p))
        .collect();
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(DirListing {
        path: dir.to_string_lossy().to_string(),
        parent: dir.parent().map(|p| p.to_string_lossy().to_string()),
        entries,
    })
}

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .map(|n| n.to_string_lossy().starts_with('.'))
        .unwrap_or(false)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| {
        eprintln!("[read_file] {path}: {e}");
        e.to_string()
    })
}

#[derive(Serialize)]
pub struct FileChunk {
    pub content: String,
    pub next_offset: u64,
    pub total_size: u64,
    pub eof: bool,
}

// Lit un fichier par tranche depuis `offset`, en coupant sur une frontière UTF-8 valide.
#[tauri::command]
pub fn read_file_chunk(path: String, offset: u64, max_bytes: u64) -> Result<FileChunk, String> {
    let mut f = fs::File::open(&path).map_err(|e| {
        eprintln!("[read_file_chunk] open {path}: {e}");
        e.to_string()
    })?;
    let total_size = f.metadata().map_err(|e| e.to_string())?.len();
    f.seek(SeekFrom::Start(offset)).map_err(|e| {
        eprintln!("[read_file_chunk] seek {path}: {e}");
        e.to_string()
    })?;

    let cap = max_bytes.min(8 * 1024 * 1024) as usize; // plafond dur 8 Mo/appel
    let mut buf = vec![0u8; cap];
    let n = f.read(&mut buf).map_err(|e| {
        eprintln!("[read_file_chunk] read {path}: {e}");
        e.to_string()
    })?;
    buf.truncate(n);

    let valid = match std::str::from_utf8(&buf) {
        Ok(_) => buf.len(),
        Err(e) => e.valid_up_to(),
    };
    let content = String::from_utf8_lossy(&buf[..valid]).into_owned();
    let next_offset = offset + valid as u64;
    let eof = n == 0 || next_offset >= total_size;

    Ok(FileChunk {
        content,
        next_offset,
        total_size,
        eof,
    })
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| {
        eprintln!("[write_file] {path}: {e}");
        e.to_string()
    })
}

#[tauri::command]
pub fn rename_entry(path: String, new_name: String) -> Result<String, String> {
    let src = Path::new(&path);
    let parent = src.parent().ok_or_else(|| "pas de parent".to_string())?;
    let dst = parent.join(&new_name);
    fs::rename(src, &dst).map_err(|e| {
        eprintln!("[rename_entry] {path} -> {new_name}: {e}");
        e.to_string()
    })?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let res = if p.is_dir() {
        fs::remove_dir_all(p)
    } else {
        fs::remove_file(p)
    };
    res.map_err(|e| {
        eprintln!("[delete_entry] {path}: {e}");
        e.to_string()
    })
}

// Recherche récursive async — spawn_blocking pour ne pas bloquer le thread IPC.
#[tauri::command]
pub async fn search_dir(root: String, query: String) -> Vec<DirEntry> {
    tauri::async_runtime::spawn_blocking(move || {
        let q = query.to_lowercase();
        let mut results = Vec::new();
        walk_search(Path::new(&root), &q, &mut results);
        results
    })
    .await
    .unwrap_or_default()
}

fn walk_search(dir: &Path, query: &str, out: &mut Vec<DirEntry>) {
    if out.len() >= 150 { return; }
    let Ok(read) = fs::read_dir(dir) else { return };
    for entry in read.filter_map(|r| r.ok()) {
        if out.len() >= 150 { return; }
        let path = entry.path();
        let name = match path.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };
        if name.starts_with('.') { continue; }
        if name.to_lowercase().contains(query) {
            if let Some(e) = to_entry(&path) { out.push(e); }
        }
        if path.is_dir() { walk_search(&path, query, out); }
    }
}

// Déplace src dans dest_dir. Refuse si dest_dir est un descendant de src.
#[tauri::command]
pub fn move_entry(src: String, dest_dir: String) -> Result<(), String> {
    let src_path = Path::new(&src);
    let dest_dir_path = Path::new(&dest_dir);
    if dest_dir_path.starts_with(src_path) {
        return Err("Impossible de déplacer un dossier dans lui-même".to_string());
    }
    let name = src_path
        .file_name()
        .ok_or_else(|| "Nom de fichier invalide".to_string())?;
    let dest = dest_dir_path.join(name);
    if dest.exists() {
        return Err(format!(
            "«{}» existe déjà dans ce dossier",
            name.to_string_lossy()
        ));
    }
    fs::rename(&src, &dest).map_err(|e| {
        eprintln!("[move_entry] {src} -> {dest_dir}: {e}");
        e.to_string()
    })
}

#[derive(Serialize)]
pub struct EntryProps {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub permissions: String,
    pub permissions_octal: u32,
    pub extension: String,
}

#[tauri::command]
pub async fn get_entry_props(path: String) -> Result<EntryProps, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::os::unix::fs::PermissionsExt;
        let p = Path::new(&path);
        let meta = p.symlink_metadata().map_err(|e| e.to_string())?;
        let mode = meta.permissions().mode();
        let name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let extension = compound_extension(&name);
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let size = if meta.is_dir() {
            dir_size_recursive(p)
        } else {
            meta.len()
        };
        Ok(EntryProps {
            name,
            path,
            is_dir: meta.is_dir(),
            size,
            modified,
            permissions: format_permissions(mode),
            permissions_octal: mode & 0o777,
            extension,
        })
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}

fn dir_size_recursive(dir: &Path) -> u64 {
    let Ok(read) = fs::read_dir(dir) else { return 0 };
    read.filter_map(|e| e.ok())
        .map(|e| {
            let p = e.path();
            match p.symlink_metadata() {
                Ok(m) if m.is_dir() => dir_size_recursive(&p),
                Ok(m) => m.len(),
                Err(_) => 0,
            }
        })
        .sum()
}

fn format_permissions(mode: u32) -> String {
    let prefix = if mode & 0o40000 != 0 { 'd' } else { '-' };
    let bits = [
        (0o400, 'r'), (0o200, 'w'), (0o100, 'x'),
        (0o040, 'r'), (0o020, 'w'), (0o010, 'x'),
        (0o004, 'r'), (0o002, 'w'), (0o001, 'x'),
    ];
    let perms: String = bits
        .iter()
        .map(|(b, c)| if mode & b != 0 { *c } else { '-' })
        .collect();
    format!("{}{}", prefix, perms)
}

// Ouvre un fichier avec l'application système par défaut (xdg-open).
#[tauri::command]
pub fn open_native(path: String) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| {
            eprintln!("[open_native] {path}: {e}");
            e.to_string()
        })
}

// Lecture binaire d'un fichier encodé en base64 (pour SheetJS côté front).
#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| {
        eprintln!("[read_file_base64] {path}: {e}");
        e.to_string()
    })?;
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
pub fn create_dir(path: String, name: String) -> Result<String, String> {
    let dst = Path::new(&path).join(&name);
    fs::create_dir(&dst).map_err(|e| {
        eprintln!("[create_dir] {path}/{name}: {e}");
        e.to_string()
    })?;
    Ok(dst.to_string_lossy().to_string())
}
