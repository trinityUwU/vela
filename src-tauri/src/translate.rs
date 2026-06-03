// Traduction locale via Argos Translate (venv dédié) : 100% offline après installation des paquets.
// Aucune dépendance cloud — les modèles open-source sont téléchargés une fois puis tournent en local.
use serde::Serialize;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Serialize, Clone)]
pub struct TranslateCapabilities {
    pub available: bool,
    pub langs: Vec<String>,
}

fn venv_python() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let p = PathBuf::from(home).join(".local/share/vela/translate-venv/bin/python");
    if p.exists() { Some(p) } else { None }
}

// Exécute un script Python dans le venv Argos, `input` passé sur stdin, retourne stdout.
fn run_py(code: &str, input: &str) -> Result<String, String> {
    let py = venv_python().ok_or("ARGOS_MISSING: venv Argos absent")?;
    let mut child = Command::new(py)
        .args(["-c", code])
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .spawn().map_err(|e| format!("lancement python échoué: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).lines().last().unwrap_or("erreur").to_string())
    }
}

const LIST_LANGS: &str = r#"
import argostranslate.translate as t
print("\n".join(sorted({l.code for l in t.get_installed_languages()})))
"#;

const TRANSLATE: &str = r#"
import sys
from argostranslate import translate as T
fr, to = sys.argv[1], sys.argv[2]
text = sys.stdin.read()
langs = T.get_installed_languages()
src = [l for l in langs if l.code == fr]
dst = [l for l in langs if l.code == to]
tr = src[0].get_translation(dst[0]) if src and dst else None
if tr is None:
    sys.stderr.write("NO_TRANSLATION")
    sys.exit(2)
sys.stdout.write(tr.translate(text))
"#;

const INSTALL: &str = r#"
import sys
import argostranslate.package as p
fr, to = sys.argv[1], sys.argv[2]
p.update_package_index()
av = p.get_available_packages()

def grab(a, b):
    m = [x for x in av if x.from_code == a and x.to_code == b]
    if not m:
        raise SystemExit(f"paquet {a}->{b} indisponible")
    p.install_from_path(m[0].download())

try:
    grab(fr, to)
except SystemExit:
    grab(fr, "en")
    grab("en", to)
print("ok")
"#;

#[tauri::command]
pub async fn translate_capabilities() -> Result<TranslateCapabilities, String> {
    tauri::async_runtime::spawn_blocking(|| {
        if venv_python().is_none() {
            return Ok(TranslateCapabilities { available: false, langs: vec![] });
        }
        let langs = run_py(LIST_LANGS, "")
            .map(|s| s.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
            .unwrap_or_default();
        Ok(TranslateCapabilities { available: true, langs })
    }).await.unwrap_or_else(|e| Err(e.to_string()))
}

// Traduit un texte de `from_lang` vers `to_lang` (codes ISO : en, fr, es…). spawn_blocking : pas de freeze.
#[tauri::command]
pub async fn translate_text(text: String, from_lang: String, to_lang: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let py = venv_python().ok_or("ARGOS_MISSING: venv Argos absent")?;
        let mut child = Command::new(py)
            .args(["-c", TRANSLATE, &from_lang, &to_lang])
            .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
            .spawn().map_err(|e| format!("lancement python échoué: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        let out = child.wait_with_output().map_err(|e| e.to_string())?;
        if out.status.success() { Ok(String::from_utf8_lossy(&out.stdout).to_string()) }
        else {
            let err = String::from_utf8_lossy(&out.stderr);
            if err.contains("NO_TRANSLATION") {
                Err(format!("LANG_MISSING:{from_lang}:{to_lang}"))
            } else {
                Err(err.lines().last().unwrap_or("traduction échouée").to_string())
            }
        }
    }).await.unwrap_or_else(|e| Err(e.to_string()))
}

// Télécharge le paquet de langue from->to (avec pivot via l'anglais si pas de paire directe).
#[tauri::command]
pub async fn translate_install_lang(from_lang: String, to_lang: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let py = venv_python().ok_or("ARGOS_MISSING: venv Argos absent")?;
        let out = Command::new(py).args(["-c", INSTALL, &from_lang, &to_lang])
            .output().map_err(|e| e.to_string())?;
        if out.status.success() { Ok(()) }
        else { Err(String::from_utf8_lossy(&out.stderr).lines().last().unwrap_or("install échouée").to_string()) }
    }).await.unwrap_or_else(|e| Err(e.to_string()))
}

// Traduit un fichier texte et écrit un sidecar « <nom>.<to_lang>.txt » à côté. Retourne le chemin produit.
#[tauri::command]
pub async fn translate_file(path: String, from_lang: String, to_lang: String) -> Result<String, String> {
    let text = std::fs::read_to_string(&path).map_err(|e| format!("lecture impossible: {e}"))?;
    let translated = translate_text(text, from_lang, to_lang.clone()).await?;
    let p = PathBuf::from(&path);
    let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "fichier".into());
    let dest = p.with_file_name(format!("{stem}.{to_lang}.txt"));
    std::fs::write(&dest, translated).map_err(|e| format!("écriture impossible: {e}"))?;
    Ok(dest.to_string_lossy().to_string())
}
