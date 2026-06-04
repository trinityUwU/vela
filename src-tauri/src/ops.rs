// Opérations fichiers avancées : corbeille XDG, copie récursive, compression, recherche contenu.
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, ErrorKind, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

// ── contrôle des transferts (pause / reprise / annulation) ───────────────────

pub struct TransferControl {
    pub paused: AtomicBool,
    pub cancelled: AtomicBool,
}

pub struct TransferManager {
    jobs: Mutex<HashMap<String, Arc<TransferControl>>>,
}

impl TransferManager {
    pub fn new() -> Self {
        Self { jobs: Mutex::new(HashMap::new()) }
    }
    fn add(&self, id: &str) -> Arc<TransferControl> {
        let c = Arc::new(TransferControl {
            paused: AtomicBool::new(false),
            cancelled: AtomicBool::new(false),
        });
        self.jobs.lock().unwrap().insert(id.to_string(), c.clone());
        c
    }
    fn get(&self, id: &str) -> Option<Arc<TransferControl>> {
        self.jobs.lock().unwrap().get(id).cloned()
    }
    fn remove(&self, id: &str) {
        self.jobs.lock().unwrap().remove(id);
    }
}

#[tauri::command]
pub fn transfer_pause(state: tauri::State<'_, TransferManager>, job_id: String) -> Result<(), String> {
    state.get(&job_id).ok_or("Transfert introuvable")?.paused.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn transfer_resume(state: tauri::State<'_, TransferManager>, job_id: String) -> Result<(), String> {
    state.get(&job_id).ok_or("Transfert introuvable")?.paused.store(false, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn transfer_cancel(state: tauri::State<'_, TransferManager>, job_id: String) -> Result<(), String> {
    let c = state.get(&job_id).ok_or("Transfert introuvable")?;
    c.cancelled.store(true, Ordering::Relaxed);
    c.paused.store(false, Ordering::Relaxed);
    Ok(())
}

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

// Restaure depuis la corbeille les éléments dont le chemin d'origine figure dans `paths`.
#[tauri::command]
pub fn restore_trash(paths: Vec<String>) -> Result<(), String> {
    let wanted: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let items = trash::os_limited::list().map_err(|e| e.to_string())?;
    let to_restore: Vec<_> = items
        .into_iter()
        .filter(|it| wanted.contains(&it.original_parent.join(&it.name)))
        .collect();
    if to_restore.is_empty() {
        return Err("Élément introuvable dans la corbeille".to_string());
    }
    trash::os_limited::restore_all(to_restore).map_err(|e| {
        eprintln!("[restore_trash] {paths:?}: {e}");
        e.to_string()
    })
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

const COPY_BUF: usize = 1024 * 1024;

// Bloque tant que le transfert est en pause ; renvoie true s'il a été annulé.
fn wait_if_paused(ctrl: &TransferControl) -> bool {
    while ctrl.paused.load(Ordering::Relaxed) && !ctrl.cancelled.load(Ordering::Relaxed) {
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    ctrl.cancelled.load(Ordering::Relaxed)
}

// Copie un fichier par tranches de 1 Mo, notifiant les octets écrits (progression intra-fichier).
// Renvoie une erreur `Interrupted` si annulé en cours de route.
fn copy_file_progress(
    src: &Path, dst: &Path, ctrl: &TransferControl, on_bytes: &mut dyn FnMut(u64),
) -> std::io::Result<()> {
    let mut reader = fs::File::open(src)?;
    let mut writer = fs::File::create(dst)?;
    let mut buf = vec![0u8; COPY_BUF];
    loop {
        if wait_if_paused(ctrl) {
            return Err(std::io::Error::new(ErrorKind::Interrupted, "annulé"));
        }
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n])?;
        on_bytes(n as u64);
    }
    if let Ok(meta) = fs::metadata(src) {
        let _ = fs::set_permissions(dst, meta.permissions());
    }
    Ok(())
}

fn copy_recursive(
    src: &Path, dst: &Path, ctrl: &TransferControl, on_bytes: &mut dyn FnMut(u64),
) -> std::io::Result<()> {
    if ctrl.cancelled.load(Ordering::Relaxed) {
        return Err(std::io::Error::new(ErrorKind::Interrupted, "annulé"));
    }
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()), ctrl, on_bytes)?;
        }
        Ok(())
    } else {
        copy_file_progress(src, dst, ctrl, on_bytes)
    }
}

// ── résolution de conflits (sûre : 0 % de perte de données) ──────────────────

// Chemin frère temporaire/caché à côté de la cible (même volume → rename atomique possible).
fn sibling_tmp(target: &Path) -> PathBuf {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let name = target.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    target.with_file_name(format!(".{name}.vela-tmp-{ts}"))
}

// Remplace un FICHIER sans jamais détruire l'ancien avant la fin : écrit un temporaire complet,
// puis bascule par rename atomique (qui écrase). Échec en cours → tmp supprimé, ancien intact.
fn replace_file_safe(src: &Path, target: &Path, ctrl: &TransferControl, on_bytes: &mut dyn FnMut(u64)) -> std::io::Result<()> {
    let tmp = sibling_tmp(target);
    if let Err(e) = copy_file_progress(src, &tmp, ctrl, on_bytes) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    fs::rename(&tmp, target)
}

// Remplace un DOSSIER : met l'ancien de côté (rename), copie le neuf, puis supprime le backup.
// Échec en cours → on supprime le partiel et on restaure le backup. L'ancien n'est jamais perdu.
fn replace_dir_safe(src: &Path, target: &Path, ctrl: &TransferControl, on_bytes: &mut dyn FnMut(u64)) -> std::io::Result<()> {
    let backup = sibling_tmp(target);
    fs::rename(target, &backup)?;
    match copy_recursive(src, target, ctrl, on_bytes) {
        Ok(()) => {
            let _ = fs::remove_dir_all(&backup);
            Ok(())
        }
        Err(e) => {
            let _ = fs::remove_dir_all(target);
            let _ = fs::rename(&backup, target);
            Err(e)
        }
    }
}

// Fusionne `src` dans le dossier `target` existant. Les fichiers en collision sont CONSERVÉS
// (suffixe « copie N »), jamais écrasés → fusion sans aucune perte.
fn merge_dir(src: &Path, target: &Path, ctrl: &TransferControl, on_bytes: &mut dyn FnMut(u64)) -> std::io::Result<()> {
    if ctrl.cancelled.load(Ordering::Relaxed) {
        return Err(std::io::Error::new(ErrorKind::Interrupted, "annulé"));
    }
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        if from.is_dir() {
            merge_dir(&from, &to, ctrl, on_bytes)?;
        } else if to.exists() {
            let name = entry.file_name().to_string_lossy().to_string();
            let unique = unique_dest(target, &name);
            copy_file_progress(&from, &unique, ctrl, on_bytes)?;
        } else {
            copy_file_progress(&from, &to, ctrl, on_bytes)?;
        }
    }
    Ok(())
}

// Conflit détecté avant transfert : un nom existe déjà dans la destination.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    name: String,
    src_path: String,
    dest_path: String,
    src_size: u64,
    dest_size: u64,
    src_is_dir: bool,
    dest_is_dir: bool,
}

// Liste les collisions de noms au niveau racine entre `paths` et `dest_dir` (pour résolution upfront).
#[tauri::command]
pub fn scan_conflicts(paths: Vec<String>, dest_dir: String) -> Vec<Conflict> {
    let dest = Path::new(&dest_dir);
    let mut out = Vec::new();
    for p in &paths {
        let src = Path::new(p);
        let Some(name) = src.file_name().map(|n| n.to_string_lossy().to_string()) else { continue };
        let target = dest.join(&name);
        if !target.exists() {
            continue;
        }
        let sm = src.metadata().ok();
        let dm = target.metadata().ok();
        out.push(Conflict {
            name,
            src_path: p.clone(),
            dest_path: target.to_string_lossy().to_string(),
            src_size: sm.as_ref().map(|m| m.len()).unwrap_or(0),
            dest_size: dm.as_ref().map(|m| m.len()).unwrap_or(0),
            src_is_dir: src.is_dir(),
            dest_is_dir: target.is_dir(),
        });
    }
    out
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

// Panneau de progression affiché si le transfert dépasse l'un de ces seuils (sinon instantané, anti-flicker).
const NOTIFY_FILE_THRESHOLD: u64 = 8;
const NOTIFY_BYTE_THRESHOLD: u64 = 100 * 1024 * 1024;
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

// Compte fichiers + total d'octets sous les chemins (pour seuil + total de progression).
fn count_files_bytes(paths: &[String]) -> (u64, u64) {
    let mut files = 0u64;
    let mut bytes = 0u64;
    for p in paths {
        for e in WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
            if e.file_type().is_file() {
                files += 1;
                bytes += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    (files, bytes)
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

// Copie plusieurs entrées dans dest_dir. `resolutions` (nom → replace|skip|keep|merge) décide des
// collisions ; sans entrée pour un nom en collision, défaut = keep (garder les deux). Aucune source
// n'est jamais détruite : un « replace » écrit un temporaire puis bascule par rename atomique.
#[tauri::command]
pub async fn copy_entries(
    app: AppHandle, paths: Vec<String>, dest_dir: String, resolutions: HashMap<String, String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest = Path::new(&dest_dir);
        let (files, total) = count_files_bytes(&paths);
        let notify = files >= NOTIFY_FILE_THRESHOLD || total >= NOTIFY_BYTE_THRESHOLD;
        let job_id = transfer_job_id();
        let label = job_label(&paths);
        let mgr = app.state::<TransferManager>();
        let ctrl = mgr.add(&job_id);
        if notify { emit_transfer(&app, &job_id, "copy", &label, 0, total, "transferring", None); }

        let mut created: Vec<String> = Vec::new();
        let current = std::cell::Cell::new(0u64);
        let last = std::cell::Cell::new(Instant::now());
        let last_paused = std::cell::Cell::new(false);
        let progress = |n: u64| {
            current.set(current.get() + n);
            let paused = ctrl.paused.load(Ordering::Relaxed);
            let status = if paused { "paused" } else { "transferring" };
            if notify && (paused != last_paused.get() || last.get().elapsed().as_millis() >= EMIT_THROTTLE_MS) {
                emit_transfer(&app, &job_id, "copy", &label, current.get(), total, status, None);
                last.set(Instant::now());
                last_paused.set(paused);
            }
        };

        for path in &paths {
            let src = Path::new(path);
            let name = match src.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => {
                    let e = format!("nom invalide: {path}");
                    if notify { emit_transfer(&app, &job_id, "copy", &label, current.get(), total, "error", Some(e.clone())); }
                    mgr.remove(&job_id);
                    return Err(e);
                }
            };
            let raw = dest.join(&name);
            let resolution = if raw.exists() {
                resolutions.get(&name).map(String::as_str).unwrap_or("keep")
            } else {
                "none"
            };
            if resolution == "skip" { continue; }
            let target = if resolution == "keep" { unique_dest(dest, &name) } else { raw.clone() };

            let mut cb = |n: u64| progress(n);
            let res = match resolution {
                "replace" if src.is_dir() => replace_dir_safe(src, &target, &ctrl, &mut cb),
                "replace" => replace_file_safe(src, &target, &ctrl, &mut cb),
                "merge" if src.is_dir() => merge_dir(src, &target, &ctrl, &mut cb),
                _ => copy_recursive(src, &target, &ctrl, &mut cb),
            };
            if let Err(e) = res {
                // Les helpers « replace » se restaurent seuls ; sinon on enlève le partiel (cible neuve).
                if resolution != "replace" {
                    let _ = if target.is_dir() { fs::remove_dir_all(&target) } else { fs::remove_file(&target) };
                }
                if e.kind() == ErrorKind::Interrupted {
                    if notify { emit_transfer(&app, &job_id, "copy", &label, current.get(), total, "cancelled", None); }
                    mgr.remove(&job_id);
                    return Ok(created);
                }
                eprintln!("[copy_entries] {path}: {e}");
                if notify { emit_transfer(&app, &job_id, "copy", &label, current.get(), total, "error", Some(e.to_string())); }
                mgr.remove(&job_id);
                return Err(e.to_string());
            }
            created.push(target.to_string_lossy().to_string());
        }
        if notify { emit_transfer(&app, &job_id, "copy", &label, total, total, "done", None); }
        mgr.remove(&job_id);
        Ok(created)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn is_cross_device(e: &std::io::Error) -> bool {
    e.raw_os_error() == Some(18) // EXDEV
}

// Déplace plusieurs entrées dans dest_dir. `resolutions` gère les collisions (replace|skip|keep|merge).
// 0 % de perte : les sources copiées (cross-device / replace / merge) ne sont supprimées qu'après la
// réussite complète du job ; un « replace » bascule par temporaire/backup. Même volume = rename instantané.
#[tauri::command]
pub async fn move_entries(
    app: AppHandle, paths: Vec<String>, dest_dir: String, resolutions: HashMap<String, String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest = Path::new(&dest_dir);
        let (files, total) = count_files_bytes(&paths);
        let notify = files >= NOTIFY_FILE_THRESHOLD || total >= NOTIFY_BYTE_THRESHOLD;
        let job_id = transfer_job_id();
        let label = job_label(&paths);
        let mgr = app.state::<TransferManager>();
        let ctrl = mgr.add(&job_id);
        if notify { emit_transfer(&app, &job_id, "move", &label, 0, total, "transferring", None); }

        let current = std::cell::Cell::new(0u64);
        let last = std::cell::Cell::new(Instant::now());
        let last_paused = std::cell::Cell::new(false);
        let progress = |n: u64| {
            current.set(current.get() + n);
            let paused = ctrl.paused.load(Ordering::Relaxed);
            let status = if paused { "paused" } else { "transferring" };
            if notify && (paused != last_paused.get() || last.get().elapsed().as_millis() >= EMIT_THROTTLE_MS) {
                emit_transfer(&app, &job_id, "move", &label, current.get(), total, status, None);
                last.set(Instant::now());
                last_paused.set(paused);
            }
        };
        let fail = |msg: String| -> Result<(), String> {
            if notify { emit_transfer(&app, &job_id, "move", &label, current.get(), total, "error", Some(msg.clone())); }
            mgr.remove(&job_id);
            Err(msg)
        };

        let mut to_delete: Vec<PathBuf> = Vec::new(); // sources copiées → suppression différée à la fin

        for path in &paths {
            if ctrl.cancelled.load(Ordering::Relaxed) {
                if notify { emit_transfer(&app, &job_id, "move", &label, current.get(), total, "cancelled", None); }
                mgr.remove(&job_id);
                return Ok(()); // sources copiées non supprimées → zéro perte
            }
            let src = Path::new(path);
            let name = match src.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => return fail(format!("nom invalide: {path}")),
            };
            if dest.starts_with(src) {
                return fail("Impossible de déplacer un dossier dans lui-même".into());
            }
            let raw = dest.join(&name);
            let resolution = if raw.exists() {
                resolutions.get(&name).map(String::as_str).unwrap_or("keep")
            } else {
                "none"
            };
            if resolution == "skip" { continue; }
            let target = if resolution == "keep" { unique_dest(dest, &name) } else { raw.clone() };
            let entry_bytes = count_files_bytes(std::slice::from_ref(path)).1;

            let mut cb = |n: u64| progress(n);
            // Ok(true) = la source a été copiée → à supprimer en fin de job ; Ok(false) = rename instantané.
            let result: std::io::Result<bool> = match resolution {
                "replace" if src.is_dir() => replace_dir_safe(src, &target, &ctrl, &mut cb).map(|_| true),
                "replace" => replace_file_safe(src, &target, &ctrl, &mut cb).map(|_| true),
                "merge" if src.is_dir() => merge_dir(src, &target, &ctrl, &mut cb).map(|_| true),
                _ => match fs::rename(src, &target) {
                    Ok(()) => { current.set(current.get() + entry_bytes); Ok(false) }
                    Err(e) if is_cross_device(&e) => copy_recursive(src, &target, &ctrl, &mut cb).map(|_| true),
                    Err(e) => Err(e),
                },
            };

            match result {
                Ok(true) => to_delete.push(src.to_path_buf()),
                Ok(false) => {}
                Err(e) => {
                    if resolution != "replace" {
                        let _ = if target.is_dir() { fs::remove_dir_all(&target) } else { fs::remove_file(&target) };
                    }
                    if e.kind() == ErrorKind::Interrupted {
                        if notify { emit_transfer(&app, &job_id, "move", &label, current.get(), total, "cancelled", None); }
                        mgr.remove(&job_id);
                        return Ok(());
                    }
                    eprintln!("[move_entries] {path}: {e}");
                    return fail(e.to_string());
                }
            }
        }

        // Succès complet : suppression des sources copiées (jamais avant la fin → zéro perte).
        for src in &to_delete {
            let _ = if src.is_dir() { fs::remove_dir_all(src) } else { fs::remove_file(src) };
        }
        if notify { emit_transfer(&app, &job_id, "move", &label, total, total, "done", None); }
        mgr.remove(&job_id);
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tmp_dir(tag: &str) -> PathBuf {
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let d = std::env::temp_dir().join(format!("vela-ops-{tag}-{ts}"));
        fs::create_dir_all(&d).unwrap();
        d
    }
    fn ctrl() -> TransferControl {
        TransferControl { paused: AtomicBool::new(false), cancelled: AtomicBool::new(false) }
    }
    fn noop() -> impl FnMut(u64) { |_| {} }

    #[test]
    fn replace_file_remplace_sans_perte() {
        let d = tmp_dir("replf");
        let src = d.join("src.txt");
        let target = d.join("t.txt");
        fs::write(&src, b"NEW").unwrap();
        fs::write(&target, b"OLD").unwrap();
        let mut cb = noop();
        replace_file_safe(&src, &target, &ctrl(), &mut cb).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "NEW");
        // aucun temporaire résiduel
        let leftovers: Vec<_> = fs::read_dir(&d).unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains("vela-tmp"))
            .collect();
        assert!(leftovers.is_empty(), "temporaire non nettoyé");
        fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn merge_garde_les_deux_jamais_ecraser() {
        let d = tmp_dir("merge");
        let src = d.join("src");
        let target = d.join("dst");
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(src.join("a.txt"), b"A_NEW").unwrap();
        fs::write(src.join("b.txt"), b"B").unwrap();
        fs::write(target.join("a.txt"), b"A_OLD").unwrap();
        let mut cb = noop();
        merge_dir(&src, &target, &ctrl(), &mut cb).unwrap();
        // l'ancien a.txt est intact, le nouveau est conservé sous un autre nom, b.txt est ajouté
        assert_eq!(fs::read_to_string(target.join("a.txt")).unwrap(), "A_OLD");
        assert_eq!(fs::read_to_string(target.join("b.txt")).unwrap(), "B");
        let copie = fs::read_dir(&target).unwrap()
            .filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().contains("copie"));
        assert!(copie, "le fichier en collision n'a pas été conservé en double");
        fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn replace_dir_remplace_et_nettoie_backup() {
        let d = tmp_dir("repld");
        let src = d.join("src");
        let target = d.join("dst");
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(src.join("new.txt"), b"NEW").unwrap();
        fs::write(target.join("old.txt"), b"OLD").unwrap();
        let mut cb = noop();
        replace_dir_safe(&src, &target, &ctrl(), &mut cb).unwrap();
        assert!(target.join("new.txt").exists());
        assert!(!target.join("old.txt").exists());
        let backups: Vec<_> = fs::read_dir(&d).unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains("vela-tmp"))
            .collect();
        assert!(backups.is_empty(), "backup non nettoyé");
        fs::remove_dir_all(&d).ok();
    }
}
