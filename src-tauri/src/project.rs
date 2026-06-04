// Détection de projet + tâches (F08) : reconnaît un dossier-projet (package.json, Cargo.toml, Makefile,
// pyproject…) et propose les commandes pertinentes. On LANCE des tâches, on ne gère aucune config de build.
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct Task {
    pub label: String,
    pub command: String,
}

#[derive(Serialize)]
pub struct ProjectInfo {
    pub kind: String,
    pub tasks: Vec<Task>,
}

fn read(path: &Path, name: &str) -> Option<String> {
    fs::read_to_string(path.join(name)).ok()
}

// Scripts de package.json → "bun run <script>" (bun par défaut, runtime de l'utilisateur jamais imposé).
fn node_tasks(content: &str, runner: &str) -> Vec<Task> {
    let mut tasks = vec![Task { label: format!("{runner} install"), command: format!("{runner} install") }];
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
            for key in scripts.keys() {
                tasks.push(Task { label: format!("{runner} run {key}"), command: format!("{runner} run {key}") });
            }
        }
    }
    tasks
}

// Cibles d'un Makefile (lignes "cible:" en début de ligne, hors variables et règles spéciales).
fn make_tasks(content: &str) -> Vec<Task> {
    let mut tasks = Vec::new();
    for line in content.lines() {
        if let Some((target, _)) = line.split_once(':') {
            let t = target.trim();
            if !t.is_empty() && !t.starts_with('.') && !t.contains(' ') && !t.contains('=') && !t.contains('/') {
                tasks.push(Task { label: format!("make {t}"), command: format!("make {t}") });
            }
        }
    }
    tasks.truncate(20);
    tasks
}

#[tauri::command]
pub fn project_detect(path: String) -> ProjectInfo {
    let dir = Path::new(&path);
    let mut tasks = Vec::new();
    let mut kind = String::new();

    if let Some(pkg) = read(dir, "package.json") {
        let runner = if dir.join("bun.lockb").exists() || dir.join("bun.lock").exists() {
            "bun"
        } else if dir.join("pnpm-lock.yaml").exists() {
            "pnpm"
        } else {
            "npm"
        };
        kind = runner.to_string();
        tasks.extend(node_tasks(&pkg, runner));
    } else if dir.join("Cargo.toml").exists() {
        kind = "cargo".into();
        for (l, c) in [("cargo build", "cargo build"), ("cargo run", "cargo run"), ("cargo test", "cargo test")] {
            tasks.push(Task { label: l.into(), command: c.into() });
        }
    } else if dir.join("pyproject.toml").exists() || dir.join("requirements.txt").exists() {
        kind = "python".into();
        if dir.join("requirements.txt").exists() {
            tasks.push(Task { label: "pip install -r requirements.txt".into(), command: "pip install -r requirements.txt".into() });
        }
    }

    if let Some(mk) = read(dir, "Makefile").or_else(|| read(dir, "makefile")) {
        if kind.is_empty() {
            kind = "make".into();
        }
        tasks.extend(make_tasks(&mk));
    }

    ProjectInfo { kind, tasks }
}
