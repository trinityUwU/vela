// Opérations fichiers avancées : corbeille XDG, copie récursive, compression, recherche contenu.
use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

// ── corbeille ───────────────────────────────────────────────────────────────

// Envoie une liste d'entrées à la corbeille XDG (réversible).
#[tauri::command]
pub fn trash_entries(paths: Vec<String>) -> Result<(), String> {
    trash::delete_all(&paths).map_err(|e| {
        eprintln!("[trash_entries] {paths:?}: {e}");
        e.to_string()
    })
}

// Supprime définitivement plusieurs entrées (Shift+Suppr).
#[tauri::command]
pub fn delete_entries(paths: Vec<String>) -> Result<(), String> {
    for path in &paths {
        let p = Path::new(path);
        let res = if p.is_dir() {
            fs::remove_dir_all(p)
        } else {
            fs::remove_file(p)
        };
        res.map_err(|e| {
            eprintln!("[delete_entries] {path}: {e}");
            e.to_string()
        })?;
    }
    Ok(())
}

fn trash_root() -> PathBuf {
    let base = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_default();
            Path::new(&home).join(".local/share")
        });
    base.join("Trash")
}

// Retourne le dossier des fichiers de la corbeille XDG (~/.local/share/Trash/files).
#[tauri::command]
pub fn trash_dir() -> String {
    trash_root().join("files").to_string_lossy().to_string()
}

// Nombre d'éléments premier niveau dans la corbeille (0 si vide ou absente).
#[tauri::command]
pub fn trash_count() -> u64 {
    fs::read_dir(trash_root().join("files"))
        .map(|r| r.count() as u64)
        .unwrap_or(0)
}

// Vide la corbeille : purge files/ et info/.
#[tauri::command]
pub fn empty_trash() -> Result<(), String> {
    let root = trash_root();
    for sub in ["files", "info"] {
        let dir = root.join(sub);
        let Ok(read) = fs::read_dir(&dir) else { continue };
        for entry in read.filter_map(|e| e.ok()) {
            let p = entry.path();
            let res = if p.is_dir() && !p.is_symlink() {
                fs::remove_dir_all(&p)
            } else {
                fs::remove_file(&p)
            };
            res.map_err(|e| {
                eprintln!("[empty_trash] {}: {e}", p.display());
                e.to_string()
            })?;
        }
    }
    Ok(())
}

// ── copie / déplacement groupés ─────────────────────────────────────────────

fn unique_dest(dest_dir: &Path, name: &str) -> PathBuf {
    let mut candidate = dest_dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(name);
    let stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let mut i = 1;
    loop {
        candidate = dest_dir.join(format!("{stem} (copie {i}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
        i += 1;
    }
}

fn copy_recursive(src: &Path, dst: &Path, on_file: &mut dyn FnMut()) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()), on_file)?;
        }
        Ok(())
    } else {
        fs::copy(src, dst)?;
        on_file();
        Ok(())
    }
}

// ── progression des transferts ───────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct TransferPayload {
    job_id: String,
    kind: String,
    name: String,
    current: u64,
    total: u64,
    status: String,
    error: Option<String>,
}

// En dessous de ce nombre de fichiers, le transfert est instantané : aucun panneau (anti-flicker).
const TRANSFER_NOTIFY_THRESHOLD: u64 = 8;
const EMIT_THROTTLE_MS: u128 = 80;

fn transfer_job_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("transfer-{ts}")
}

fn emit_transfer(
    app: &AppHandle, job_id: &str, kind: &str, name: &str,
    current: u64, total: u64, status: &str, error: Option<String>,
) {
    let _ = app.emit("transfer-progress", TransferPayload {
        job_id: job_id.to_string(),
        kind: kind.to_string(),
        name: name.to_string(),
        current, total,
        status: status.to_string(),
        error,
    });
}

fn count_files(paths: &[String]) -> u64 {
    paths.iter().map(|p| {
        WalkDir::new(p).into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .count() as u64
    }).sum()
}

fn job_label(paths: &[String]) -> String {
    match paths.split_first() {
        Some((first, rest)) => {
            let name = Path::new(first).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if rest.is_empty() { name } else { format!("{name} +{}", rest.len()) }
        }
        None => String::new(),
    }
}

// Copie plusieurs entrées dans dest_dir, en évitant l'écrasement (suffixe « copie N »).
#[tauri::command]
pub async fn copy_entries(app: AppHandle, paths: Vec<String>, dest_dir: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest = Path::new(&dest_dir);
        let total = count_files(&paths);
        let notify = total >= TRANSFER_NOTIFY_THRESHOLD;
        let job_id = transfer_job_id();
        let label = job_label(&paths);
        if notify { emit_transfer(&app, &job_id, "copy", &label, 0, total, "transferring", None); }

        let mut current = 0u64;
        let mut last = Instant::now();
        for path in &paths {
            let src = Path::new(path);
            let name = match src.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => {
                    let e = format!("nom invalide: {path}");
                    if notify { emit_transfer(&app, &job_id, "copy", &label, current, total, "error", Some(e.clone())); }
                    return Err(e);
                }
            };
            let target = unique_dest(dest, &name);
            let res = copy_recursive(src, &target, &mut || {
                current += 1;
                if notify && last.elapsed().as_millis() >= EMIT_THROTTLE_MS {
                    emit_transfer(&app, &job_id, "copy", &label, current, total, "transferring", None);
                    last = Instant::now();
                }
            });
            if let Err(e) = res {
                eprintln!("[copy_entries] {path}: {e}");
                if notify { emit_transfer(&app, &job_id, "copy", &label, current, total, "error", Some(e.to_string())); }
                return Err(e.to_string());
            }
        }
        if notify { emit_transfer(&app, &job_id, "copy", &label, total, total, "done", None); }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// Déplace plusieurs entrées dans dest_dir.
#[tauri::command]
pub async fn move_entries(app: AppHandle, paths: Vec<String>, dest_dir: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest = Path::new(&dest_dir);
        let total = paths.len() as u64;
        let notify = total >= TRANSFER_NOTIFY_THRESHOLD;
        let job_id = transfer_job_id();
        let label = job_label(&paths);
        if notify { emit_transfer(&app, &job_id, "move", &label, 0, total, "transferring", None); }

        let mut current = 0u64;
        for path in &paths {
            let src = Path::new(path);
            if dest.starts_with(src) {
                let e = "Impossible de déplacer un dossier dans lui-même".to_string();
                if notify { emit_transfer(&app, &job_id, "move", &label, current, total, "error", Some(e.clone())); }
                return Err(e);
            }
            let name = match src.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => {
                    let e = format!("nom invalide: {path}");
                    if notify { emit_transfer(&app, &job_id, "move", &label, current, total, "error", Some(e.clone())); }
                    return Err(e);
                }
            };
            let target = dest.join(&name);
            if target.exists() {
                let e = format!("«{name}» existe déjà dans ce dossier");
                if notify { emit_transfer(&app, &job_id, "move", &label, current, total, "error", Some(e.clone())); }
                return Err(e);
            }
            if let Err(e) = fs::rename(src, &target) {
                eprintln!("[move_entries] {path}: {e}");
                if notify { emit_transfer(&app, &job_id, "move", &label, current, total, "error", Some(e.to_string())); }
                return Err(e.to_string());
            }
            current += 1;
            if notify { emit_transfer(&app, &job_id, "move", &label, current, total, "transferring", None); }
        }
        if notify { emit_transfer(&app, &job_id, "move", &label, total, total, "done", None); }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── compression ─────────────────────────────────────────────────────────────

fn zip_add_path(
    writer: &mut zip::ZipWriter<fs::File>,
    base: &Path,
    src: &Path,
    opts: SimpleFileOptions,
) -> std::io::Result<()> {
    for entry in WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let rel = path.strip_prefix(base).unwrap_or(path).to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            if !rel.is_empty() {
                writer.add_directory(format!("{rel}/"), opts)?;
            }
        } else {
            writer.start_file(rel, opts)?;
            let mut f = fs::File::open(path)?;
            std::io::copy(&mut f, writer)?;
        }
    }
    Ok(())
}

fn create_zip(paths: &[String], dest: &Path) -> std::io::Result<()> {
    let file = fs::File::create(dest)?;
    let mut writer = zip::ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for path in paths {
        let src = Path::new(path);
        let base = src.parent().unwrap_or(Path::new("/"));
        zip_add_path(&mut writer, base, src, opts)?;
    }
    writer.finish()?;
    Ok(())
}

fn create_targz(paths: &[String], dest: &Path) -> std::io::Result<()> {
    let file = fs::File::create(dest)?;
    let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut builder = tar::Builder::new(enc);
    for path in paths {
        let src = Path::new(path);
        let name = src.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if src.is_dir() {
            builder.append_dir_all(&name, src)?;
        } else {
            let mut f = fs::File::open(src)?;
            builder.append_file(&name, &mut f)?;
        }
    }
    builder.into_inner()?.finish()?;
    Ok(())
}

// Crée une archive (format « zip » ou « targz ») depuis une sélection de chemins.
#[tauri::command]
pub fn create_archive(paths: Vec<String>, dest: String, format: String) -> Result<String, String> {
    let dest_path = Path::new(&dest);
    let res = match format.as_str() {
        "zip" => create_zip(&paths, dest_path),
        "targz" => create_targz(&paths, dest_path),
        other => return Err(format!("format inconnu: {other}")),
    };
    res.map_err(|e| {
        eprintln!("[create_archive] {dest}: {e}");
        e.to_string()
    })?;
    Ok(dest)
}

// ── recherche dans le contenu ───────────────────────────────────────────────

#[derive(Serialize)]
pub struct ContentMatch {
    pub path: String,
    pub name: String,
    pub line: u64,
    pub text: String,
}

const SKIP_DIRS: &[&str] = &[".git", "node_modules", "target", ".venv", "__pycache__", "dist"];
const MAX_MATCHES: usize = 200;
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;

fn is_probably_binary(first_bytes: &[u8]) -> bool {
    first_bytes.contains(&0)
}

fn scan_file(path: &Path, query: &str, out: &mut Vec<ContentMatch>) {
    let Ok(meta) = path.metadata() else { return };
    if meta.len() > MAX_FILE_BYTES {
        return;
    }
    let Ok(file) = fs::File::open(path) else { return };
    let mut reader = BufReader::new(file);
    let mut probe = [0u8; 512];
    use std::io::Read as _;
    let n = reader.read(&mut probe).unwrap_or(0);
    if is_probably_binary(&probe[..n]) {
        return;
    }
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return,
    };
    let reader = BufReader::new(file);
    let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    for (idx, line) in reader.lines().enumerate() {
        let Ok(line) = line else { break };
        if line.to_lowercase().contains(query) {
            out.push(ContentMatch {
                path: path.to_string_lossy().to_string(),
                name: name.clone(),
                line: idx as u64 + 1,
                text: line.trim().chars().take(200).collect(),
            });
            if out.len() >= MAX_MATCHES {
                return;
            }
        }
    }
}

// Recherche `query` dans le contenu texte des fichiers sous `root` (récursif, async).
#[tauri::command]
pub async fn search_content(root: String, query: String) -> Vec<ContentMatch> {
    tauri::async_runtime::spawn_blocking(move || {
        let q = query.to_lowercase();
        let mut out = Vec::new();
        if q.is_empty() {
            return out;
        }
        let walker = WalkDir::new(&root).into_iter().filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !(e.depth() > 0 && (name.starts_with('.') || SKIP_DIRS.contains(&name.as_ref())))
        });
        for entry in walker.filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                scan_file(entry.path(), &q, &mut out);
                if out.len() >= MAX_MATCHES {
                    break;
                }
            }
        }
        out
    })
    .await
    .unwrap_or_default()
}
