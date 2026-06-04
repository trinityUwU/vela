// Lecture et extraction d'archives : ZIP, TAR variants, RAR/7Z via commande système.
// Extraction asynchrone avec progression, pause/reprise/annulation, mots de passe.
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

// ── types publics ─────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct ArchiveEntry {
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub compressed_size: u64,
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    job_id: String,
    archive_name: String,
    dest: String,
    current: u64,
    total: u64,
    status: String,
    error: Option<String>,
}

// ── ExtractionManager ─────────────────────────────────────────────────────────

pub struct JobControl {
    pub paused: Arc<AtomicBool>,
    pub cancelled: Arc<AtomicBool>,
    pub password: Arc<Mutex<Option<String>>>,
    pub child_pid: Arc<Mutex<Option<u32>>>,
}

pub struct ExtractionManager {
    pub jobs: Mutex<HashMap<String, Arc<JobControl>>>,
}

impl ExtractionManager {
    pub fn new() -> Self {
        Self { jobs: Mutex::new(HashMap::new()) }
    }

    pub fn add(&self, id: &str) -> Arc<JobControl> {
        let jc = Arc::new(JobControl {
            paused: Arc::new(AtomicBool::new(false)),
            cancelled: Arc::new(AtomicBool::new(false)),
            password: Arc::new(Mutex::new(None)),
            child_pid: Arc::new(Mutex::new(None)),
        });
        self.jobs.lock().unwrap().insert(id.to_string(), jc.clone());
        jc
    }

    fn get(&self, id: &str) -> Option<Arc<JobControl>> {
        self.jobs.lock().unwrap().get(id).cloned()
    }

    fn remove(&self, id: &str) {
        self.jobs.lock().unwrap().remove(id);
    }
}

// ── helpers ───────────────────────────────────────────────────────────────────

pub fn new_job_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("job-{ts}")
}

// Émet une progression de job générique vers le panneau d'activité (event extraction-progress).
// Permet à d'autres modules (CodeIndex…) d'afficher leurs tâches longues en bas à droite.
pub fn emit_progress(app: &AppHandle, job_id: &str, name: &str, dest: &str,
    current: u64, total: u64, status: &str, error: Option<String>) {
    emit(app, ProgressPayload {
        job_id: job_id.to_string(),
        archive_name: name.to_string(),
        dest: dest.to_string(),
        current, total, status: status.to_string(), error,
    });
}

fn emit(app: &AppHandle, p: ProgressPayload) {
    let _ = app.emit("extraction-progress", p);
}

fn pause_wait(jc: &JobControl) -> bool {
    while jc.paused.load(Ordering::Relaxed) && !jc.cancelled.load(Ordering::Relaxed) {
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    jc.cancelled.load(Ordering::Relaxed)
}

fn wait_password(jc: &JobControl) -> Option<String> {
    loop {
        if jc.cancelled.load(Ordering::Relaxed) { return None; }
        let pwd = jc.password.lock().unwrap().clone();
        if pwd.is_some() { return pwd; }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

fn signal_pid(pid: u32, sig: &str) {
    let _ = Command::new("kill").args([&format!("-{sig}"), &pid.to_string()]).status();
}

fn base_payload(job_id: &str, archive_name: &str, dest: &str) -> ProgressPayload {
    ProgressPayload {
        job_id: job_id.to_string(),
        archive_name: archive_name.to_string(),
        dest: dest.to_string(),
        current: 0,
        total: 0,
        status: "extracting".into(),
        error: None,
    }
}

fn finish(app: &AppHandle, mut p: ProgressPayload, err: Option<String>) {
    p.status = if err.is_some() { "error".into() } else { "done".into() };
    p.error = err;
    emit(app, p);
}

// ── format detection ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
enum Format {
    Zip, Tar, TarGz, TarBz2, TarXz,
    GzSingle, Bz2Single, XzSingle,
    SevenZ, Rar, Unknown,
}

fn detect_format(path: &str) -> Format {
    let l = path.to_lowercase();
    if l.ends_with(".tar.gz")  || l.ends_with(".tgz")   { return Format::TarGz; }
    if l.ends_with(".tar.bz2") || l.ends_with(".tbz2")  { return Format::TarBz2; }
    if l.ends_with(".tar.xz")  || l.ends_with(".txz")   { return Format::TarXz; }
    if l.ends_with(".tar.zst") || l.ends_with(".tar")   { return Format::Tar; }
    if l.ends_with(".zip") || l.ends_with(".jar") || l.ends_with(".war") || l.ends_with(".ear") {
        return Format::Zip;
    }
    if l.ends_with(".7z")  { return Format::SevenZ; }
    if l.ends_with(".rar") { return Format::Rar; }
    if l.ends_with(".gz")  { return Format::GzSingle; }
    if l.ends_with(".bz2") { return Format::Bz2Single; }
    if l.ends_with(".xz")  { return Format::XzSingle; }
    Format::Unknown
}

// ── list (inchangé) ───────────────────────────────────────────────────────────

fn list_zip(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let f = archive.by_index(i).map_err(|e| e.to_string())?;
        entries.push(ArchiveEntry {
            name: f.name().trim_end_matches('/').to_string(),
            size: f.size(), is_dir: f.is_dir(), compressed_size: f.compressed_size(),
        });
    }
    Ok(sort_entries(entries))
}

fn list_tar_reader<R: Read>(reader: R) -> Result<Vec<ArchiveEntry>, String> {
    let mut archive = tar::Archive::new(reader);
    let mut entries = Vec::new();
    for entry in archive.entries().map_err(|e| e.to_string())? {
        let e = entry.map_err(|e| e.to_string())?;
        let header = e.header();
        let name = e.path().map_err(|e| e.to_string())?.to_string_lossy().trim_end_matches('/').to_string();
        entries.push(ArchiveEntry {
            name, size: header.size().unwrap_or(0),
            is_dir: header.entry_type().is_dir(), compressed_size: 0,
        });
    }
    Ok(sort_entries(entries))
}

fn list_via_7z(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let cmd = find_7z().ok_or_else(|| "7z non trouvé — installer p7zip-full".to_string())?;
    let out = Command::new(cmd).args(["l", "-slt", path]).output().map_err(|e| e.to_string())?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).to_string()); }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    let (mut name, mut size, mut csize, mut is_dir) = (String::new(), 0u64, 0u64, false);
    for line in text.lines() {
        if let Some(v) = line.strip_prefix("Path = ") { name = v.trim().to_string(); }
        else if let Some(v) = line.strip_prefix("Size = ") { size = v.trim().parse().unwrap_or(0); }
        else if let Some(v) = line.strip_prefix("Packed Size = ") { csize = v.trim().parse().unwrap_or(0); }
        else if let Some(v) = line.strip_prefix("Attributes = ") { is_dir = v.contains('D'); }
        else if line.trim().is_empty() && !name.is_empty() {
            entries.push(ArchiveEntry { name: name.trim_end_matches('/').to_string(), size, is_dir, compressed_size: csize });
            name = String::new(); size = 0; csize = 0; is_dir = false;
        }
    }
    Ok(sort_entries(entries))
}

// ── extraction avec progression ───────────────────────────────────────────────

fn zip_is_encrypted(path: &str) -> bool {
    let Ok(file) = fs::File::open(path) else { return false };
    let Ok(mut archive) = zip::ZipArchive::new(file) else { return false };
    (0..archive.len()).any(|i| archive.by_index_raw(i).map(|f| f.encrypted()).unwrap_or(false))
}

fn run_zip_job(app: AppHandle, jc: Arc<JobControl>, job_id: String, path: String, dest: String) {
    let archive_name = Path::new(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
    let base = base_payload(&job_id, &archive_name, &dest);
    let dest_path = Path::new(&dest);

    // Détection mot de passe
    let password: Option<String> = if zip_is_encrypted(&path) {
        emit(&app, ProgressPayload { status: "password_required".into(), ..base.clone() });
        let pwd = wait_password(&jc);
        if pwd.is_none() { finish(&app, base, Some("Annulé".into())); return; }
        // Réinitialise le verrou après lecture
        *jc.password.lock().unwrap() = None;
        pwd
    } else {
        None
    };

    if let Err(e) = fs::create_dir_all(dest_path) {
        finish(&app, base, Some(e.to_string())); return;
    }

    let Ok(file) = fs::File::open(&path).map_err(|e| e.to_string()) else {
        finish(&app, base, Some("Impossible d'ouvrir l'archive".into())); return;
    };
    let Ok(mut archive) = zip::ZipArchive::new(file).map_err(|e| e.to_string()) else {
        finish(&app, base, Some("Archive ZIP invalide".into())); return;
    };

    let total = archive.len() as u64;
    for i in 0..archive.len() {
        if pause_wait(&jc) { finish(&app, base, Some("Annulé".into())); return; }

        let result: Result<(), String> = (|| {
            if let Some(ref pwd) = password {
                let mut entry = archive.by_index_decrypt(i, pwd.as_bytes()).map_err(|e| e.to_string())?;
                write_zip_entry(&mut entry, dest_path)
            } else {
                let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
                write_zip_entry(&mut entry, dest_path)
            }
        })();

        if let Err(e) = result { finish(&app, base, Some(e)); return; }
        emit(&app, ProgressPayload { current: (i + 1) as u64, total, ..base.clone() });
    }
    finish(&app, base, None);
}

fn write_zip_entry(entry: &mut zip::read::ZipFile, dest: &Path) -> Result<(), String> {
    use std::io::Write;
    let out_path = dest.join(entry.mangled_name());
    if entry.is_dir() {
        fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
    } else {
        if let Some(p) = out_path.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
        let mut out = fs::File::create(&out_path).map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        out.write_all(&buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn make_tar_reader(path: &str, fmt: Format) -> Result<Box<dyn Read + Send>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    Ok(match fmt {
        Format::TarGz  => Box::new(flate2::read::GzDecoder::new(file)),
        Format::TarBz2 => Box::new(bzip2::read::BzDecoder::new(file)),
        Format::TarXz  => Box::new(xz2::read::XzDecoder::new(file)),
        _              => Box::new(file),
    })
}

fn run_tar_job(app: AppHandle, jc: Arc<JobControl>, job_id: String, path: String, dest: String, fmt: Format) {
    let archive_name = Path::new(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
    let base = base_payload(&job_id, &archive_name, &dest);
    let dest_path = Path::new(&dest);

    if let Err(e) = fs::create_dir_all(dest_path) { finish(&app, base, Some(e.to_string())); return; }

    let reader = match make_tar_reader(&path, fmt) {
        Ok(r) => r,
        Err(e) => { finish(&app, base, Some(e)); return; }
    };

    let mut archive = tar::Archive::new(reader);
    let mut current = 0u64;
    let entries_result = archive.entries().map_err(|e| e.to_string());
    let Ok(entries) = entries_result else {
        finish(&app, base, Some("Impossible de lire l'archive".into())); return;
    };

    for entry in entries {
        if pause_wait(&jc) { finish(&app, base, Some("Annulé".into())); return; }
        let mut entry = match entry { Ok(e) => e, Err(e) => { finish(&app, base, Some(e.to_string())); return; } };
        if let Err(e) = entry.unpack_in(dest_path).map_err(|e| e.to_string()) {
            finish(&app, base, Some(e)); return;
        }
        current += 1;
        emit(&app, ProgressPayload { current, total: 0, ..base.clone() });
    }
    finish(&app, base, None);
}

fn run_single_job(app: AppHandle, jc: Arc<JobControl>, job_id: String, path: String, dest: String, fmt: Format) {
    let archive_name = Path::new(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
    let base = base_payload(&job_id, &archive_name, &dest);
    if let Err(e) = fs::create_dir_all(&dest) { finish(&app, base, Some(e.to_string())); return; }
    if pause_wait(&jc) { finish(&app, base, Some("Annulé".into())); return; }
    let dest_path = Path::new(&dest);
    let stem = Path::new(&path).file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "file".into());
    let file = match fs::File::open(&path) { Ok(f) => f, Err(e) => { finish(&app, base, Some(e.to_string())); return; } };
    let mut buf = Vec::new();
    let err = match fmt {
        Format::GzSingle  => flate2::read::GzDecoder::new(file).read_to_end(&mut buf).map_err(|e| e.to_string()).and_then(|_| fs::write(dest_path.join(&stem), &buf).map_err(|e| e.to_string())).err(),
        Format::Bz2Single => bzip2::read::BzDecoder::new(file).read_to_end(&mut buf).map_err(|e| e.to_string()).and_then(|_| fs::write(dest_path.join(&stem), &buf).map_err(|e| e.to_string())).err(),
        Format::XzSingle  => xz2::read::XzDecoder::new(file).read_to_end(&mut buf).map_err(|e| e.to_string()).and_then(|_| fs::write(dest_path.join(&stem), &buf).map_err(|e| e.to_string())).err(),
        _ => Some("Format inconnu".into()),
    };
    finish(&app, base, err);
}

// Détecte un contenu chiffré (7z/rar/zip via 7z) en lisant les en-têtes — sans mot de passe.
fn archive_is_encrypted_7z(cmd: &str, path: &str) -> bool {
    Command::new(cmd).args(["l", "-slt", path])
        .stdin(std::process::Stdio::null())
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("Encrypted = +"))
        .unwrap_or(false)
}

fn run_7z_job(app: AppHandle, jc: Arc<JobControl>, job_id: String, path: String, dest: String, password: Option<String>) {
    let archive_name = Path::new(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
    let base = base_payload(&job_id, &archive_name, &dest);

    let Some(cmd) = find_7z() else {
        finish(&app, base, Some("7z non trouvé — installer p7zip-full".into())); return;
    };
    if let Err(e) = fs::create_dir_all(&dest) { finish(&app, base, Some(e.to_string())); return; }

    // Mot de passe requis détecté en amont : sinon 7z x bloque sur le prompt stdin (0% figé).
    let password = if password.is_none() && archive_is_encrypted_7z(cmd, &path) {
        emit(&app, ProgressPayload { status: "password_required".into(), ..base.clone() });
        let pwd = wait_password(&jc);
        if pwd.is_none() { finish(&app, base, Some("Annulé".into())); return; }
        *jc.password.lock().unwrap() = None;
        pwd
    } else {
        password
    };

    let mut args = vec!["x".to_string(), path.clone(), format!("-o{dest}"), "-y".to_string(), "-bsp1".to_string()];
    if let Some(ref pwd) = password { args.push(format!("-p{pwd}")); }

    let mut child = match Command::new(cmd).args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .spawn() {
        Ok(c) => c, Err(e) => { finish(&app, base, Some(e.to_string())); return; }
    };
    *jc.child_pid.lock().unwrap() = Some(child.id());

    // Lit le stdout dans un thread séparé pour le monitoring
    let stdout = child.stdout.take().unwrap();
    let jc2 = jc.clone();
    let base2 = base.clone();
    let app2 = app.clone();
    std::thread::spawn(move || {
        use std::io::BufRead;
        for line in std::io::BufReader::new(stdout).lines().flatten() {
            if jc2.cancelled.load(Ordering::Relaxed) { break; }
            while jc2.paused.load(Ordering::Relaxed) && !jc2.cancelled.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            if let Some(pct) = parse_7z_progress(&line) {
                emit(&app2, ProgressPayload { current: pct, total: 100, ..base2.clone() });
            }
        }
    });

    let status = child.wait();
    let pid = jc.child_pid.lock().unwrap().take();

    if jc.cancelled.load(Ordering::Relaxed) {
        if let Some(p) = pid { signal_pid(p, "KILL"); }
        finish(&app, base, Some("Annulé".into())); return;
    }

    let ok = status.map(|s| s.success()).unwrap_or(false);
    if ok { finish(&app, base, None); return; }

    // Vérifie si erreur de mot de passe
    let test_output = Command::new(cmd).args(["t", &path]).stdin(std::process::Stdio::null()).output().ok();
    let stderr = test_output.as_ref().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    let needs_pwd = stderr.to_lowercase().contains("wrong password") || stderr.to_lowercase().contains("enter password") || stderr.contains("ERROR");

    if needs_pwd && password.is_none() {
        *jc.password.lock().unwrap() = None;
        emit(&app, ProgressPayload { status: "password_required".into(), ..base.clone() });
        let pwd = wait_password(&jc);
        if let Some(p) = pwd {
            run_7z_job(app, jc, job_id, path, dest, Some(p));
        } else {
            finish(&app, base, Some("Annulé".into()));
        }
    } else {
        finish(&app, base, Some("Extraction échouée".into()));
    }
}

fn parse_7z_progress(line: &str) -> Option<u64> {
    let t = line.trim();
    if t.is_empty() { return None; }
    if let Some(pct_part) = t.split('%').next() {
        let cleaned = pct_part.trim();
        if !cleaned.is_empty() { return cleaned.parse().ok(); }
    }
    None
}

// ── compression avec progression ──────────────────────────────────────────────

struct CompressItem {
    abs: PathBuf,
    rel: String,
    is_dir: bool,
}

// Liste récursive des fichiers à compresser, avec chemin relatif au parent de chaque racine.
fn walk_compress_items(paths: &[String]) -> Vec<CompressItem> {
    let mut out = Vec::new();
    for path in paths {
        let src = Path::new(path);
        let base = src.parent().unwrap_or_else(|| Path::new("/"));
        for entry in walkdir::WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
            let p = entry.path();
            let rel = p.strip_prefix(base).unwrap_or(p).to_string_lossy().replace('\\', "/");
            if rel.is_empty() { continue; }
            out.push(CompressItem { abs: p.to_path_buf(), rel, is_dir: p.is_dir() });
        }
    }
    out
}

fn compress_base(job_id: &str, dest: &Path) -> ProgressPayload {
    let archive_name = dest.file_name().unwrap_or_default().to_string_lossy().to_string();
    let parent = dest.parent().unwrap_or_else(|| Path::new("/")).to_string_lossy().to_string();
    ProgressPayload { status: "compressing".into(), ..base_payload(job_id, &archive_name, &parent) }
}

fn zip_write_item(writer: &mut zip::ZipWriter<fs::File>, it: &CompressItem,
    opts: zip::write::SimpleFileOptions) -> std::io::Result<()> {
    if it.is_dir {
        writer.add_directory(format!("{}/", it.rel), opts)?;
    } else {
        writer.start_file(it.rel.clone(), opts)?;
        let mut f = fs::File::open(&it.abs)?;
        std::io::copy(&mut f, writer)?;
    }
    Ok(())
}

fn run_zip_compress_job(app: AppHandle, jc: Arc<JobControl>, job_id: String, paths: Vec<String>, dest: String) {
    let dest_path = Path::new(&dest);
    let base = compress_base(&job_id, dest_path);
    let items = walk_compress_items(&paths);
    let total = items.len() as u64;
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let Ok(file) = fs::File::create(dest_path) else {
        finish(&app, base, Some("Impossible de créer l'archive".into())); return;
    };
    let mut writer = zip::ZipWriter::new(file);
    for (i, it) in items.iter().enumerate() {
        if pause_wait(&jc) { let _ = fs::remove_file(dest_path); finish(&app, base, Some("Annulé".into())); return; }
        if let Err(e) = zip_write_item(&mut writer, it, opts) { finish(&app, base, Some(e.to_string())); return; }
        emit(&app, ProgressPayload { current: (i + 1) as u64, total, ..base.clone() });
    }
    match writer.finish() {
        Ok(_) => finish(&app, base, None),
        Err(e) => finish(&app, base, Some(e.to_string())),
    }
}

fn run_targz_compress_job(app: AppHandle, jc: Arc<JobControl>, job_id: String, paths: Vec<String>, dest: String) {
    let dest_path = Path::new(&dest);
    let base = compress_base(&job_id, dest_path);
    let items = walk_compress_items(&paths);
    let total = items.len() as u64;
    let Ok(file) = fs::File::create(dest_path) else {
        finish(&app, base, Some("Impossible de créer l'archive".into())); return;
    };
    let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut builder = tar::Builder::new(enc);
    for (i, it) in items.iter().enumerate() {
        if pause_wait(&jc) { let _ = fs::remove_file(dest_path); finish(&app, base, Some("Annulé".into())); return; }
        let r = if it.is_dir { builder.append_dir(&it.rel, &it.abs) }
            else { fs::File::open(&it.abs).and_then(|mut f| builder.append_file(&it.rel, &mut f)) };
        if let Err(e) = r { finish(&app, base, Some(e.to_string())); return; }
        emit(&app, ProgressPayload { current: (i + 1) as u64, total, ..base.clone() });
    }
    match builder.into_inner().and_then(|enc| enc.finish()) {
        Ok(_) => finish(&app, base, None),
        Err(e) => finish(&app, base, Some(e.to_string())),
    }
}

// Compression via 7z (formats 7z/zip avec mot de passe + AES). Progression parsée sur -bsp1.
fn run_7z_compress_job(app: AppHandle, jc: Arc<JobControl>, job_id: String,
    paths: Vec<String>, dest: String, as_zip: bool, pwd: Option<String>) {
    let base = compress_base(&job_id, Path::new(&dest));
    let Some(cmd) = find_7z() else {
        finish(&app, base, Some("7z non trouvé — installer p7zip".into())); return;
    };
    let mut args = vec!["a".to_string(), "-bsp1".to_string(), "-y".to_string()];
    if as_zip { args.push("-tzip".to_string()); }
    // Chiffrement des données uniquement (pas -mhe : les noms restent lisibles, sinon le listing
    // sans mot de passe renvoie une archive « vide » et l'extraction ne détecte pas le besoin de passe).
    if let Some(ref p) = pwd { args.push(format!("-p{p}")); }
    args.push(dest.clone());
    args.extend(paths);
    run_cli_archiver(app, jc, base, cmd, args);
}

fn find_rar() -> Option<&'static str> {
    ["rar"].iter().find(|c| {
        Command::new("which").arg(c).output().map(|o| o.status.success()).unwrap_or(false)
    }).copied()
}

// Compression via rar (mot de passe + en-têtes chiffrés via -hp). Progression indéterminée.
fn run_rar_compress_job(app: AppHandle, jc: Arc<JobControl>, job_id: String,
    paths: Vec<String>, dest: String, pwd: Option<String>) {
    let base = compress_base(&job_id, Path::new(&dest));
    let Some(cmd) = find_rar() else {
        finish(&app, base, Some("rar non trouvé — installer rar".into())); return;
    };
    let mut args = vec!["a".to_string(), "-ep1".to_string(), "-y".to_string()];
    // -p (données) et non -hp (en-têtes) : noms lisibles → Vela liste + détecte le mot de passe à l'extraction.
    if let Some(ref p) = pwd { args.push(format!("-p{p}")); }
    args.push("--".to_string());
    args.push(dest.clone());
    args.extend(paths);
    run_cli_archiver(app, jc, base, cmd, args);
}

// Exécute un archiveur CLI (7z/rar) avec monitoring stdout/progression, pause/cancel via signaux.
fn run_cli_archiver(app: AppHandle, jc: Arc<JobControl>, base: ProgressPayload, cmd: &str, args: Vec<String>) {
    emit(&app, base.clone());
    // stdin null : sinon 7z/rar héritent du stdin du GUI et bloquent sur un prompt
    // (confirmation de mot de passe, message d'évaluation rar…) → freeze + archive vide.
    let mut child = match Command::new(cmd).args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn() {
        Ok(c) => c, Err(e) => { finish(&app, base, Some(e.to_string())); return; }
    };
    *jc.child_pid.lock().unwrap() = Some(child.id());
    let stdout = child.stdout.take().unwrap();
    let (jc2, base2, app2) = (jc.clone(), base.clone(), app.clone());
    std::thread::spawn(move || {
        use std::io::BufRead;
        for line in std::io::BufReader::new(stdout).lines().map_while(Result::ok) {
            if jc2.cancelled.load(Ordering::Relaxed) { break; }
            while jc2.paused.load(Ordering::Relaxed) && !jc2.cancelled.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            if let Some(pct) = parse_7z_progress(&line) {
                emit(&app2, ProgressPayload { current: pct, total: 100, ..base2.clone() });
            }
        }
    });
    let status = child.wait();
    let pid = jc.child_pid.lock().unwrap().take();
    if jc.cancelled.load(Ordering::Relaxed) {
        if let Some(p) = pid { signal_pid(p, "KILL"); }
        let _ = fs::remove_file(format!("{}/{}", base.dest, base.archive_name));
        finish(&app, base, Some("Annulé".into())); return;
    }
    match status.map(|s| s.success()).unwrap_or(false) {
        true => finish(&app, base, None),
        false => finish(&app, base, Some("Compression échouée".into())),
    }
}

// ── tauri commands ────────────────────────────────────────────────────────────

// Crée une archive en tâche de fond (progression/pause/annulation). Formats : zip, targz, 7z, rar.
// `password` (optionnel) chiffre l'archive — supporté pour zip (via 7z), 7z (AES) et rar.
#[tauri::command]
pub async fn start_compression(
    app: AppHandle,
    state: tauri::State<'_, ExtractionManager>,
    paths: Vec<String>,
    dest: String,
    format: String,
    password: Option<String>,
) -> Result<String, String> {
    let pwd = password.filter(|p| !p.is_empty());
    let job_id = new_job_id();
    let jc = state.add(&job_id);
    let jid = job_id.clone();
    std::thread::spawn(move || match (format.as_str(), pwd) {
        ("zip", None)   => run_zip_compress_job(app, jc, jid, paths, dest),
        ("targz", _)    => run_targz_compress_job(app, jc, jid, paths, dest),
        ("zip", pwd)    => run_7z_compress_job(app, jc, jid, paths, dest, true, pwd),
        ("7z", pwd)     => run_7z_compress_job(app, jc, jid, paths, dest, false, pwd),
        ("rar", pwd)    => run_rar_compress_job(app, jc, jid, paths, dest, pwd),
        (other, _)      => finish(&app, compress_base(&jid, Path::new(&dest)), Some(format!("format inconnu: {other}"))),
    });
    Ok(job_id)
}

#[tauri::command]
pub async fn list_archive(path: String) -> Result<Vec<ArchiveEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        match detect_format(&path) {
            Format::Zip       => list_zip(&path),
            Format::TarGz     => { let f = fs::File::open(&path).map_err(|e| e.to_string())?; list_tar_reader(flate2::read::GzDecoder::new(f)) }
            Format::TarBz2    => { let f = fs::File::open(&path).map_err(|e| e.to_string())?; list_tar_reader(bzip2::read::BzDecoder::new(f)) }
            Format::TarXz     => { let f = fs::File::open(&path).map_err(|e| e.to_string())?; list_tar_reader(xz2::read::XzDecoder::new(f)) }
            Format::Tar       => { let f = fs::File::open(&path).map_err(|e| e.to_string())?; list_tar_reader(f) }
            Format::GzSingle | Format::Bz2Single | Format::XzSingle => {
                let name = PathBuf::from(&path).file_name().unwrap_or_default().to_string_lossy().to_string();
                let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                Ok(vec![ArchiveEntry { name, size, is_dir: false, compressed_size: size }])
            }
            Format::SevenZ | Format::Rar | Format::Unknown => list_via_7z(&path),
        }
    }).await.unwrap_or_else(|e| Err(e.to_string()))
}

#[tauri::command]
pub async fn start_extraction(
    app: AppHandle,
    state: tauri::State<'_, ExtractionManager>,
    path: String,
    dest: String,
) -> Result<String, String> {
    let job_id = new_job_id();
    let jc = state.add(&job_id);
    let fmt = detect_format(&path);
    let jid = job_id.clone();

    std::thread::spawn(move || match fmt {
        Format::Zip                 => run_zip_job(app, jc, jid, path, dest),
        Format::TarGz | Format::TarBz2 | Format::TarXz | Format::Tar
                                    => run_tar_job(app, jc, jid, path, dest, fmt),
        Format::GzSingle | Format::Bz2Single | Format::XzSingle
                                    => run_single_job(app, jc, jid, path, dest, fmt),
        Format::SevenZ | Format::Rar | Format::Unknown
                                    => run_7z_job(app, jc, jid, path, dest, None),
    });

    Ok(job_id)
}

#[tauri::command]
pub fn extraction_pause(state: tauri::State<'_, ExtractionManager>, job_id: String) -> Result<(), String> {
    let jc = state.get(&job_id).ok_or("Job introuvable")?;
    jc.paused.store(true, Ordering::Relaxed);
    if let Some(pid) = *jc.child_pid.lock().unwrap() { signal_pid(pid, "STOP"); }
    Ok(())
}

#[tauri::command]
pub fn extraction_resume(state: tauri::State<'_, ExtractionManager>, job_id: String) -> Result<(), String> {
    let jc = state.get(&job_id).ok_or("Job introuvable")?;
    jc.paused.store(false, Ordering::Relaxed);
    if let Some(pid) = *jc.child_pid.lock().unwrap() { signal_pid(pid, "CONT"); }
    Ok(())
}

#[tauri::command]
pub fn extraction_cancel(state: tauri::State<'_, ExtractionManager>, job_id: String) -> Result<(), String> {
    let jc = state.get(&job_id).ok_or("Job introuvable")?;
    jc.paused.store(false, Ordering::Relaxed);
    jc.cancelled.store(true, Ordering::Relaxed);
    if let Some(pid) = *jc.child_pid.lock().unwrap() { signal_pid(pid, "KILL"); }
    state.remove(&job_id);
    Ok(())
}

#[tauri::command]
pub fn extraction_provide_password(
    state: tauri::State<'_, ExtractionManager>,
    job_id: String,
    password: String,
) -> Result<(), String> {
    let jc = state.get(&job_id).ok_or("Job introuvable")?;
    *jc.password.lock().unwrap() = Some(password);
    Ok(())
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn find_7z() -> Option<&'static str> {
    ["7z", "7za", "7zz"].iter().find(|c| {
        Command::new("which").arg(c).output().map(|o| o.status.success()).unwrap_or(false)
    }).copied()
}

fn sort_entries(mut v: Vec<ArchiveEntry>) -> Vec<ArchiveEntry> {
    v.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    v
}
