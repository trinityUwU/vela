// Index global des noms de fichiers en mémoire, construit en tâche de fond. Recherche instantanée.
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use tauri::State;
use walkdir::WalkDir;

struct IndexedEntry {
    path: String,
    name_lc: String,
    is_dir: bool,
}

#[derive(Clone)]
pub struct SearchIndex {
    entries: Arc<RwLock<Vec<IndexedEntry>>>,
    building: Arc<AtomicBool>,
}

#[derive(Serialize)]
pub struct IndexResult {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub extension: String,
}

fn is_excluded(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "node_modules" | "target" | "__pycache__" | "venv")
}

fn basename(path: &str) -> String {
    Path::new(path).file_name().and_then(|n| n.to_str()).unwrap_or(path).to_string()
}

fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 => name[i + 1..].to_string(),
        _ => String::new(),
    }
}

// Score de subséquence : None si un caractère manque, sinon bonus consécutif + début.
fn subseq_score(q: &str, target: &str) -> Option<i32> {
    let (qb, tb) = (q.as_bytes(), target.as_bytes());
    let mut qi = 0;
    let mut score = 0;
    let mut prev: i32 = -2;
    for (ti, &c) in tb.iter().enumerate() {
        if qi < qb.len() && c == qb[qi] {
            score += if ti as i32 == prev + 1 { 3 } else { 1 };
            if ti == 0 { score += 3; }
            prev = ti as i32;
            qi += 1;
        }
    }
    if qi == qb.len() { Some(score) } else { None }
}

impl SearchIndex {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
            building: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn rebuild_from_home(&self) {
        let home = match std::env::var("HOME") {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[index] HOME introuvable: {e}");
                return;
            }
        };
        if self.building.swap(true, Ordering::SeqCst) {
            return; // build déjà en cours
        }
        let mut fresh = Vec::new();
        let walker = WalkDir::new(&home)
            .into_iter()
            .filter_entry(|e| e.file_name().to_str().map(|n| !is_excluded(n)).unwrap_or(false));
        for entry in walker.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                fresh.push(IndexedEntry {
                    path: entry.path().to_string_lossy().into_owned(),
                    name_lc: name.to_lowercase(),
                    is_dir: entry.file_type().is_dir(),
                });
            }
        }
        if let Ok(mut guard) = self.entries.write() {
            *guard = fresh;
        }
        self.building.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn index_refresh(state: State<SearchIndex>) {
    let idx = state.inner().clone();
    std::thread::spawn(move || idx.rebuild_from_home());
}

#[tauri::command]
pub fn global_search(state: State<SearchIndex>, query: String, limit: usize) -> Vec<IndexResult> {
    let q = query.to_lowercase();
    if q.is_empty() {
        return Vec::new();
    }
    let entries = match state.entries.read() {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };
    let mut scored: Vec<(i32, &IndexedEntry)> = entries
        .iter()
        .filter_map(|e| subseq_score(&q, &e.name_lc).map(|s| (s, e)))
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored
        .into_iter()
        .take(limit)
        .map(|(_, e)| {
            let name = basename(&e.path);
            let extension = extension_of(&name);
            IndexResult { path: e.path.clone(), name, is_dir: e.is_dir, extension }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subseq_matches_and_rejects() {
        assert!(subseq_score("abc", "axbxc").is_some());
        assert!(subseq_score("abc", "ab").is_none());
    }

    #[test]
    fn consecutive_scores_higher() {
        let consec = subseq_score("abc", "abc").unwrap();
        let spread = subseq_score("abc", "axbxc").unwrap();
        assert!(consec > spread);
    }

    #[test]
    fn excludes_noise_dirs() {
        assert!(is_excluded(".git"));
        assert!(is_excluded("node_modules"));
        assert!(!is_excluded("src"));
    }
}
