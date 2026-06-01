// Lecture et extraction d'archives : ZIP, TAR variants, RAR/7Z via commande système.
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Clone)]
pub struct ArchiveEntry {
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub compressed_size: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Format {
    Zip,
    Tar,
    TarGz,
    TarBz2,
    TarXz,
    GzSingle,
    Bz2Single,
    XzSingle,
    SevenZ,
    Rar,
    Unknown,
}

fn detect_format(path: &str) -> Format {
    let lower = path.to_lowercase();
    if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") { return Format::TarGz; }
    if lower.ends_with(".tar.bz2") || lower.ends_with(".tbz2") { return Format::TarBz2; }
    if lower.ends_with(".tar.xz") || lower.ends_with(".txz") { return Format::TarXz; }
    if lower.ends_with(".tar.zst") || lower.ends_with(".tar.lz4") || lower.ends_with(".tar") {
        return Format::Tar;
    }
    if lower.ends_with(".zip") || lower.ends_with(".jar") || lower.ends_with(".war")
        || lower.ends_with(".ear") { return Format::Zip; }
    if lower.ends_with(".7z") { return Format::SevenZ; }
    if lower.ends_with(".rar") { return Format::Rar; }
    if lower.ends_with(".gz") { return Format::GzSingle; }
    if lower.ends_with(".bz2") { return Format::Bz2Single; }
    if lower.ends_with(".xz") { return Format::XzSingle; }
    Format::Unknown
}

// ── list ─────────────────────────────────────────────────────────────────────

fn list_zip(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let f = archive.by_index(i).map_err(|e| e.to_string())?;
        entries.push(ArchiveEntry {
            name: f.name().trim_end_matches('/').to_string(),
            size: f.size(),
            is_dir: f.is_dir(),
            compressed_size: f.compressed_size(),
        });
    }
    Ok(sort_entries(entries))
}

fn list_tar_gz(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let dec = flate2::read::GzDecoder::new(file);
    list_tar_reader(dec)
}

fn list_tar_bz2(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let dec = bzip2::read::BzDecoder::new(file);
    list_tar_reader(dec)
}

fn list_tar_xz(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let dec = xz2::read::XzDecoder::new(file);
    list_tar_reader(dec)
}

fn list_tar_plain(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    list_tar_reader(file)
}

fn list_tar_reader<R: Read>(reader: R) -> Result<Vec<ArchiveEntry>, String> {
    let mut archive = tar::Archive::new(reader);
    let mut entries = Vec::new();
    for entry in archive.entries().map_err(|e| e.to_string())? {
        let e = entry.map_err(|e| e.to_string())?;
        let header = e.header();
        let name = e.path().map_err(|e| e.to_string())?.to_string_lossy().trim_end_matches('/').to_string();
        let size = header.size().unwrap_or(0);
        let is_dir = header.entry_type().is_dir();
        entries.push(ArchiveEntry { name, size, is_dir, compressed_size: size });
    }
    Ok(sort_entries(entries))
}

fn list_via_7z(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let cmd = ["7z", "7za", "7zz"].iter().find(|c| which(c)).copied()
        .ok_or_else(|| "7z non trouvé — installer p7zip-full".to_string())?;
    let out = Command::new(cmd)
        .args(["l", "-slt", path])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    let mut cur_name = String::new();
    let mut cur_size: u64 = 0;
    let mut cur_csize: u64 = 0;
    let mut cur_dir = false;
    for line in text.lines() {
        if line.starts_with("Path = ") && !line.contains("7-Zip") {
            cur_name = line[7..].trim().to_string();
        } else if line.starts_with("Size = ") {
            cur_size = line[7..].trim().parse().unwrap_or(0);
        } else if line.starts_with("Packed Size = ") {
            cur_csize = line[14..].trim().parse().unwrap_or(0);
        } else if line.starts_with("Attributes = ") {
            cur_dir = line.contains('D');
        } else if line.trim().is_empty() && !cur_name.is_empty() {
            entries.push(ArchiveEntry {
                name: cur_name.trim_end_matches('/').to_string(),
                size: cur_size,
                is_dir: cur_dir,
                compressed_size: cur_csize,
            });
            cur_name = String::new();
            cur_size = 0;
            cur_csize = 0;
            cur_dir = false;
        }
    }
    Ok(sort_entries(entries))
}

// ── extract ───────────────────────────────────────────────────────────────────

fn extract_zip(path: &str, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    archive.extract(dest).map_err(|e| e.to_string())
}

fn extract_tar_gz(path: &str, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let dec = flate2::read::GzDecoder::new(file);
    extract_tar_reader(dec, dest)
}

fn extract_tar_bz2(path: &str, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let dec = bzip2::read::BzDecoder::new(file);
    extract_tar_reader(dec, dest)
}

fn extract_tar_xz(path: &str, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let dec = xz2::read::XzDecoder::new(file);
    extract_tar_reader(dec, dest)
}

fn extract_tar_plain(path: &str, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    extract_tar_reader(file, dest)
}

fn extract_tar_reader<R: Read>(reader: R, dest: &Path) -> Result<(), String> {
    let mut archive = tar::Archive::new(reader);
    archive.set_preserve_permissions(true);
    archive.unpack(dest).map_err(|e| e.to_string())
}

fn extract_gz_single(path: &str, dest: &Path) -> Result<(), String> {
    let name = Path::new(path).file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "fichier".to_string());
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut dec = flate2::read::GzDecoder::new(file);
    let mut buf = Vec::new();
    dec.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    fs::write(dest.join(name), buf).map_err(|e| e.to_string())
}

fn extract_bz2_single(path: &str, dest: &Path) -> Result<(), String> {
    let name = Path::new(path).file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "fichier".to_string());
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut dec = bzip2::read::BzDecoder::new(file);
    let mut buf = Vec::new();
    dec.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    fs::write(dest.join(name), buf).map_err(|e| e.to_string())
}

fn extract_xz_single(path: &str, dest: &Path) -> Result<(), String> {
    let name = Path::new(path).file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "fichier".to_string());
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut dec = xz2::read::XzDecoder::new(file);
    let mut buf = Vec::new();
    dec.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    fs::write(dest.join(name), buf).map_err(|e| e.to_string())
}

fn extract_via_7z(path: &str, dest: &Path) -> Result<(), String> {
    let cmd = ["7z", "7za", "7zz"].iter().find(|c| which(c)).copied()
        .ok_or_else(|| "7z non trouvé — installer p7zip-full".to_string())?;
    let out = Command::new(cmd)
        .args(["x", path, &format!("-o{}", dest.display()), "-y"])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

// ── tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_archive(path: String) -> Result<Vec<ArchiveEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        match detect_format(&path) {
            Format::Zip       => list_zip(&path),
            Format::TarGz     => list_tar_gz(&path),
            Format::TarBz2    => list_tar_bz2(&path),
            Format::TarXz     => list_tar_xz(&path),
            Format::Tar       => list_tar_plain(&path),
            Format::GzSingle | Format::Bz2Single | Format::XzSingle => {
                let name = PathBuf::from(&path)
                    .file_name().unwrap_or_default()
                    .to_string_lossy().to_string();
                let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                Ok(vec![ArchiveEntry { name, size, is_dir: false, compressed_size: size }])
            }
            Format::SevenZ | Format::Rar | Format::Unknown => list_via_7z(&path),
        }
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}

#[tauri::command]
pub async fn extract_archive(path: String, dest: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest_path = Path::new(&dest);
        fs::create_dir_all(dest_path).map_err(|e| e.to_string())?;
        match detect_format(&path) {
            Format::Zip       => extract_zip(&path, dest_path),
            Format::TarGz     => extract_tar_gz(&path, dest_path),
            Format::TarBz2    => extract_tar_bz2(&path, dest_path),
            Format::TarXz     => extract_tar_xz(&path, dest_path),
            Format::Tar       => extract_tar_plain(&path, dest_path),
            Format::GzSingle  => extract_gz_single(&path, dest_path),
            Format::Bz2Single => extract_bz2_single(&path, dest_path),
            Format::XzSingle  => extract_xz_single(&path, dest_path),
            Format::SevenZ | Format::Rar | Format::Unknown => extract_via_7z(&path, dest_path),
        }
    })
    .await
    .unwrap_or_else(|e| Err(e.to_string()))
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn which(cmd: &str) -> bool {
    Command::new("which").arg(cmd).output().map(|o| o.status.success()).unwrap_or(false)
}

fn sort_entries(mut v: Vec<ArchiveEntry>) -> Vec<ArchiveEntry> {
    v.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    v
}
