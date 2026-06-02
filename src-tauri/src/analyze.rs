// Analyse disque d'un dossier : fichiers les plus volumineux + doublons (hash du contenu).
use serde::Serialize;
use std::collections::HashMap;
use std::hash::Hasher;
use std::path::PathBuf;
use walkdir::WalkDir;

const TOP_LARGEST: usize = 40;
const MAX_DUP_GROUPS: usize = 60;
const HASH_CAP: u64 = 2 * 1024 * 1024 * 1024; // ne pas hasher au-delà de 2 Go par fichier

#[derive(Serialize)]
pub struct LargeFile {
    path: String,
    name: String,
    size: u64,
}

#[derive(Serialize)]
pub struct DupGroup {
    size: u64,
    paths: Vec<String>,
}

#[derive(Serialize)]
pub struct DiskReport {
    total_size: u64,
    file_count: u64,
    largest: Vec<LargeFile>,
    duplicates: Vec<DupGroup>,
}

fn hash_file(path: &PathBuf) -> Option<u64> {
    let bytes = std::fs::read(path).ok()?;
    let mut h = std::collections::hash_map::DefaultHasher::new();
    h.write(&bytes);
    Some(h.finish())
}

fn find_duplicates(by_size: HashMap<u64, Vec<PathBuf>>) -> Vec<DupGroup> {
    let mut groups: Vec<DupGroup> = Vec::new();
    for (size, files) in by_size {
        if size == 0 || files.len() < 2 || size > HASH_CAP {
            continue;
        }
        let mut by_hash: HashMap<u64, Vec<PathBuf>> = HashMap::new();
        for f in files {
            if let Some(hash) = hash_file(&f) {
                by_hash.entry(hash).or_default().push(f);
            }
        }
        for (_, dups) in by_hash {
            if dups.len() > 1 {
                groups.push(DupGroup {
                    size,
                    paths: dups.iter().map(|p| p.to_string_lossy().to_string()).collect(),
                });
            }
        }
    }
    groups.sort_by(|a, b| (b.size * b.paths.len() as u64).cmp(&(a.size * a.paths.len() as u64)));
    groups.truncate(MAX_DUP_GROUPS);
    groups
}

#[tauri::command]
pub fn analyze_disk(path: String) -> Result<DiskReport, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Le chemin n'est pas un dossier".to_string());
    }

    let mut total_size: u64 = 0;
    let mut file_count: u64 = 0;
    let mut all: Vec<(PathBuf, u64)> = Vec::new();
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();

    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let size = match entry.metadata() {
            Ok(m) => m.len(),
            Err(e) => {
                eprintln!("[analyze_disk] {:?}: {e}", entry.path());
                continue;
            }
        };
        let p = entry.path().to_path_buf();
        total_size += size;
        file_count += 1;
        by_size.entry(size).or_default().push(p.clone());
        all.push((p, size));
    }

    all.sort_by(|a, b| b.1.cmp(&a.1));
    let largest: Vec<LargeFile> = all
        .into_iter()
        .take(TOP_LARGEST)
        .map(|(p, size)| LargeFile {
            name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
            path: p.to_string_lossy().to_string(),
            size,
        })
        .collect();

    Ok(DiskReport {
        total_size,
        file_count,
        largest,
        duplicates: find_duplicates(by_size),
    })
}
