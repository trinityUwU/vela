// Intégration git native via git2/libgit2 (vendored, offline) : statut, staging, commit, branches, log, diff.
use git2::{BranchType, ObjectType, Repository, Status, StatusOptions};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize)]
pub struct GitCommit {
    pub id: String,
    pub summary: String,
    pub author: String,
}

#[derive(Serialize)]
pub struct GitDiff {
    pub old: String,
    pub new: String,
}

fn open(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| format!("pas un dépôt git: {e}"))
}

fn workdir_of(repo: &Repository) -> Result<PathBuf, String> {
    repo.workdir().map(|p| p.to_path_buf()).ok_or_else(|| "dépôt sans copie de travail".into())
}

fn rel_of(workdir: &Path, abs: &str) -> PathBuf {
    Path::new(abs).strip_prefix(workdir).unwrap_or_else(|_| Path::new(abs)).to_path_buf()
}

fn map_status(s: Status) -> &'static str {
    if s.is_ignored() {
        "ignored"
    } else if s.intersects(Status::WT_NEW | Status::INDEX_NEW) {
        "new"
    } else if s.intersects(Status::WT_DELETED | Status::INDEX_DELETED) {
        "deleted"
    } else if s.intersects(Status::WT_RENAMED | Status::INDEX_RENAMED) {
        "renamed"
    } else {
        "modified"
    }
}

#[tauri::command]
pub fn git_repo_root(path: String) -> Option<String> {
    let repo = Repository::discover(&path).ok()?;
    repo.workdir().map(|p| p.to_string_lossy().into_owned())
}

fn status_blocking(path: &str) -> Result<Vec<GitFileStatus>, String> {
    let repo = open(path)?;
    let workdir = workdir_of(&repo)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(false).include_ignored(false);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for e in statuses.iter() {
        if let Some(rel) = e.path() {
            let st = e.status();
            out.push(GitFileStatus {
                path: workdir.join(rel).to_string_lossy().into_owned(),
                status: map_status(st).to_string(),
                staged: st.intersects(
                    Status::INDEX_NEW | Status::INDEX_MODIFIED | Status::INDEX_DELETED
                        | Status::INDEX_RENAMED | Status::INDEX_TYPECHANGE,
                ),
            });
        }
    }
    Ok(out)
}

// Async + spawn_blocking : git_status est appelé à chaque fs-changed/navigation ; ne doit jamais
// bloquer le main thread (les commandes sync Tauri y tournent) sur un gros dépôt.
#[tauri::command]
pub async fn git_status(path: String) -> Result<Vec<GitFileStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || status_blocking(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn git_current_branch(path: String) -> Result<String, String> {
    let repo = open(&path)?;
    let head = repo.head().map_err(|e| e.to_string())?;
    Ok(head.shorthand().unwrap_or("HEAD").to_string())
}

// Commits d'avance/de retard de la branche courante vs son upstream. Err si pas d'upstream.
#[tauri::command]
pub fn git_ahead_behind(path: String) -> Result<(usize, usize), String> {
    let repo = open(&path)?;
    let head = repo.head().map_err(|e| e.to_string())?;
    let local = head.target().ok_or("HEAD sans cible")?;
    let branch_name = head.shorthand().ok_or("branche inconnue")?;
    let upstream = repo
        .find_branch(branch_name, BranchType::Local)
        .and_then(|b| b.upstream())
        .map_err(|e| format!("pas d'upstream : {e}"))?;
    let up_oid = upstream.get().target().ok_or("upstream sans cible")?;
    repo.graph_ahead_behind(local, up_oid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<String>, String> {
    let repo = open(&path)?;
    let branches = repo.branches(Some(BranchType::Local)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for b in branches {
        let (branch, _) = b.map_err(|e| e.to_string())?;
        if let Ok(Some(name)) = branch.name() {
            out.push(name.to_string());
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn git_log(path: String, limit: usize) -> Result<Vec<GitCommit>, String> {
    let repo = open(&path)?;
    let mut walk = repo.revwalk().map_err(|e| e.to_string())?;
    walk.push_head().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for oid in walk.take(limit) {
        let oid = oid.map_err(|e| e.to_string())?;
        let c = repo.find_commit(oid).map_err(|e| e.to_string())?;
        out.push(GitCommit {
            id: oid.to_string().chars().take(7).collect(),
            summary: c.summary().unwrap_or("").to_string(),
            author: c.author().name().unwrap_or("").to_string(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn git_stage(path: String, paths: Vec<String>) -> Result<(), String> {
    let repo = open(&path)?;
    let workdir = workdir_of(&repo)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    for p in &paths {
        let rel = rel_of(&workdir, p);
        if Path::new(p).exists() {
            index.add_path(&rel).map_err(|e| e.to_string())?;
        } else {
            index.remove_path(&rel).map_err(|e| e.to_string())?;
        }
    }
    index.write().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_unstage(path: String, paths: Vec<String>) -> Result<(), String> {
    let repo = open(&path)?;
    let workdir = workdir_of(&repo)?;
    let head = match repo.head().and_then(|h| h.peel(ObjectType::Commit)) {
        Ok(obj) => obj,
        Err(_) => return Ok(()), // pas encore de commit initial
    };
    let rels: Vec<String> = paths.iter().map(|p| rel_of(&workdir, p).to_string_lossy().into_owned()).collect();
    repo.reset_default(Some(&head), rels.iter().map(|s| s.as_str())).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo = open(&path)?;
    let sig = repo.signature().map_err(|e| format!("signature git (configure user.name/email): {e}"))?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(index.write_tree().map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;
    Ok(oid.to_string().chars().take(7).collect())
}

#[tauri::command]
pub fn git_checkout_branch(path: String, name: String) -> Result<(), String> {
    let repo = open(&path)?;
    let (obj, reference) = repo.revparse_ext(&name).map_err(|e| e.to_string())?;
    repo.checkout_tree(&obj, None).map_err(|e| e.to_string())?;
    match reference {
        Some(r) => repo.set_head(r.name().ok_or("référence invalide")?).map_err(|e| e.to_string()),
        None => repo.set_head_detached(obj.id()).map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub fn git_diff_file(path: String, file: String) -> Result<GitDiff, String> {
    let repo = open(&path)?;
    let workdir = workdir_of(&repo)?;
    let rel = rel_of(&workdir, &file);
    let new = std::fs::read_to_string(&file).unwrap_or_default();
    let old = repo
        .head()
        .and_then(|h| h.peel_to_tree())
        .ok()
        .and_then(|tree| tree.get_path(&rel).ok())
        .and_then(|entry| repo.find_blob(entry.id()).ok())
        .map(|blob| String::from_utf8_lossy(blob.content()).into_owned())
        .unwrap_or_default();
    Ok(GitDiff { old, new })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn init_repo(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("vela_git_{}_{tag}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let run = |args: &[&str]| { Command::new("git").args(args).current_dir(&dir).output().unwrap(); };
        run(&["init", "-q"]);
        run(&["config", "user.email", "t@t.t"]);
        run(&["config", "user.name", "t"]);
        std::fs::write(dir.join("a.txt"), "v1\n").unwrap();
        run(&["add", "."]);
        run(&["commit", "-qm", "init"]);
        dir
    }

    #[test]
    fn status_detects_modification() {
        if Command::new("git").arg("--version").output().is_err() {
            return;
        }
        let dir = init_repo("status");
        std::fs::write(dir.join("a.txt"), "v2\n").unwrap();
        std::fs::write(dir.join("b.txt"), "new\n").unwrap();
        let st = status_blocking(&dir.to_string_lossy()).unwrap();
        let by = |name: &str| st.iter().find(|s| s.path.ends_with(name)).map(|s| s.status.as_str());
        assert_eq!(by("a.txt"), Some("modified"));
        assert_eq!(by("b.txt"), Some("new"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn diff_returns_head_and_worktree() {
        if Command::new("git").arg("--version").output().is_err() {
            return;
        }
        let dir = init_repo("diff");
        let file = dir.join("a.txt");
        std::fs::write(&file, "v2\n").unwrap();
        let d = git_diff_file(dir.to_string_lossy().into(), file.to_string_lossy().into()).unwrap();
        assert_eq!(d.old, "v1\n");
        assert_eq!(d.new, "v2\n");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
