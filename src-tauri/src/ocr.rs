// OCR local via tesseract (optionnel). Image directe ; PDF scanné via pdftoppm → tesseract.
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct OcrCapabilities {
    pub tesseract: bool,
    pub langs: Vec<String>,
}

fn binary_exists(name: &str, arg: &str) -> bool {
    match Command::new(name).arg(arg).output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[ocr] {name} {arg} failed: {e}");
            false
        }
    }
}

fn parse_langs(stdout: &str) -> Vec<String> {
    stdout.lines().skip(1).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
}

fn tesseract_langs() -> Vec<String> {
    match Command::new("tesseract").arg("--list-langs").output() {
        Ok(out) => parse_langs(&String::from_utf8_lossy(&out.stdout)),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
pub fn ocr_capabilities() -> OcrCapabilities {
    let tesseract = binary_exists("tesseract", "--version");
    OcrCapabilities {
        langs: if tesseract { tesseract_langs() } else { Vec::new() },
        tesseract,
    }
}

fn ocr_image(input: &str, lang: &str) -> Result<String, String> {
    let out = Command::new("tesseract")
        .arg(input)
        .arg("stdout")
        .args(["-l", lang])
        .output()
        .map_err(|e| format!("tesseract introuvable: {e}"))?;
    if !out.status.success() {
        return Err(format!("tesseract a échoué: {}", String::from_utf8_lossy(&out.stderr)));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn ocr_pdf(input: &str, lang: &str) -> Result<String, String> {
    let tmp = std::env::temp_dir().join(format!("vela_ocr_{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| format!("tmp: {e}"))?;
    let prefix = tmp.join("page");
    let status = Command::new("pdftoppm")
        .args(["-png", "-r", "150"])
        .arg(input)
        .arg(&prefix)
        .status()
        .map_err(|e| format!("pdftoppm introuvable: {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err("pdftoppm a échoué".into());
    }
    let mut pages: Vec<_> = std::fs::read_dir(&tmp)
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("png"))
        .collect();
    pages.sort();
    let mut text = String::new();
    for page in pages {
        text.push_str(&ocr_image(&page.to_string_lossy(), lang)?);
        text.push('\n');
    }
    let _ = std::fs::remove_dir_all(&tmp);
    Ok(text)
}

// Async + spawn_blocking : l'OCR peut être lent, ne doit pas bloquer le main thread.
#[tauri::command]
pub async fn ocr_extract(path: String, lang: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let l = if lang.is_empty() { "eng".to_string() } else { lang };
        if path.to_lowercase().ends_with(".pdf") {
            ocr_pdf(&path, &l)
        } else {
            ocr_image(&path, &l)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_langs_skips_header() {
        let out = "List of available languages (3):\neng\nfra\nosd\n";
        assert_eq!(parse_langs(out), vec!["eng", "fra", "osd"]);
    }

    #[test]
    fn capabilities_invariant() {
        let c = ocr_capabilities();
        assert_eq!(c.langs.is_empty() || c.tesseract, true);
    }
}
