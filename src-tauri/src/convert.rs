// Conversion universelle locale : images (crate image), documents (pandoc), bureautique → pdf
// (libreoffice headless), image → pdf (printpdf, octets bruts pour éviter les conflits de version image).
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "ico"];
const IMAGE_TARGETS: &[&str] = &["png", "jpg", "webp", "bmp", "tiff", "pdf"];
const DOC_EXTS: &[&str] = &["md", "markdown", "html", "htm", "docx", "odt", "rtf", "epub", "rst", "tex", "txt"];
const DOC_TARGETS: &[&str] = &["pdf", "docx", "odt", "html", "md", "epub", "txt"];
const OFFICE_EXTS: &[&str] = &["docx", "xlsx", "pptx", "odt", "ods", "odp", "doc", "xls", "ppt"];

#[derive(Serialize)]
pub struct ConvertCapabilities {
    pub pandoc: bool,
    pub libreoffice: bool,
}

fn binary_exists(name: &str, arg: &str) -> bool {
    match Command::new(name).arg(arg).output() {
        Ok(out) => out.status.success(),
        Err(e) => {
            eprintln!("[convert] {name} {arg} failed: {e}");
            false
        }
    }
}

fn libreoffice_bin() -> Option<String> {
    ["libreoffice", "soffice"].into_iter().find(|b| binary_exists(b, "--version")).map(String::from)
}

#[tauri::command]
pub fn convert_capabilities() -> ConvertCapabilities {
    ConvertCapabilities {
        pandoc: binary_exists("pandoc", "--version"),
        libreoffice: libreoffice_bin().is_some(),
    }
}

fn ext_of(path: &str) -> String {
    Path::new(path).extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase()
}

/// Formats cibles possibles selon l'extension source (table de routage pure).
#[tauri::command]
pub fn convert_targets(path: String) -> Vec<String> {
    let e = ext_of(&path);
    let pick = |all: &[&str]| all.iter().filter(|t| **t != e).map(|t| t.to_string()).collect::<Vec<_>>();
    if IMAGE_EXTS.contains(&e.as_str()) {
        return pick(IMAGE_TARGETS);
    }
    if DOC_EXTS.contains(&e.as_str()) {
        return pick(DOC_TARGETS);
    }
    if OFFICE_EXTS.contains(&e.as_str()) {
        return vec!["pdf".into()];
    }
    vec![]
}

fn out_path(input: &str, target: &str) -> PathBuf {
    let p = Path::new(input);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let dir = p.parent().unwrap_or_else(|| Path::new("."));
    let mut out = dir.join(format!("{stem}.{target}"));
    let mut n = 1;
    while out.exists() {
        out = dir.join(format!("{stem} ({n}).{target}"));
        n += 1;
    }
    out
}

#[tauri::command]
pub fn convert_file(input: String, target: String) -> Result<String, String> {
    let src = ext_of(&input);
    let out = out_path(&input, &target);
    let is_image = IMAGE_EXTS.contains(&src.as_str());
    let result = if is_image && target == "pdf" {
        image_to_pdf(&input, &out)
    } else if is_image {
        convert_image(&input, &out)
    } else if target == "pdf" && OFFICE_EXTS.contains(&src.as_str()) {
        convert_office(&input, &out)
    } else {
        convert_doc(&input, &out)
    };
    result.map(|_| out.to_string_lossy().into_owned())
}

fn convert_image(input: &str, out: &Path) -> Result<(), String> {
    image::open(input)
        .map_err(|e| format!("ouverture image: {e}"))?
        .save(out)
        .map_err(|e| format!("écriture image: {e}"))
}

fn convert_doc(input: &str, out: &Path) -> Result<(), String> {
    let status = Command::new("pandoc")
        .arg(input)
        .arg("-o")
        .arg(out)
        .status()
        .map_err(|e| format!("pandoc introuvable: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("pandoc a échoué (un moteur PDF est peut-être requis pour cette cible)".into())
    }
}

fn convert_office(input: &str, out: &Path) -> Result<(), String> {
    let bin = libreoffice_bin().ok_or("libreoffice introuvable")?;
    let tmp = std::env::temp_dir().join(format!("vela_lo_{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| format!("tmp: {e}"))?;
    let status = Command::new(&bin)
        .args(["--headless", "--convert-to", "pdf", "--outdir"])
        .arg(&tmp)
        .arg(input)
        .status()
        .map_err(|e| format!("libreoffice spawn: {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err("libreoffice a échoué".into());
    }
    let stem = Path::new(input).file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let produced = tmp.join(format!("{stem}.pdf"));
    let moved = std::fs::rename(&produced, out).or_else(|_| std::fs::copy(&produced, out).map(|_| ()));
    let _ = std::fs::remove_dir_all(&tmp);
    moved.map_err(|e| format!("déplacement résultat: {e}"))
}

fn image_to_pdf(input: &str, out: &Path) -> Result<(), String> {
    use printpdf::*;
    let rgb = ::image::open(input).map_err(|e| format!("image: {e}"))?.to_rgb8();
    let (w, h) = (rgb.width(), rgb.height());
    let dpi = 72.0_f32;
    let mm = |px: u32| Mm(px as f32 / dpi * 25.4);
    let (doc, page, layer) = PdfDocument::new("vela", mm(w), mm(h), "image");
    let xobject = ImageXObject {
        width: Px(w as usize),
        height: Px(h as usize),
        color_space: ColorSpace::Rgb,
        bits_per_component: ColorBits::Bit8,
        interpolate: true,
        image_data: rgb.into_raw(),
        image_filter: None,
        clipping_bbox: None,
        smask: None,
    };
    let img = Image::from(xobject);
    img.add_to_layer(
        doc.get_page(page).get_layer(layer),
        ImageTransform { dpi: Some(dpi), ..Default::default() },
    );
    let file = std::fs::File::create(out).map_err(|e| format!("création pdf: {e}"))?;
    doc.save(&mut std::io::BufWriter::new(file)).map_err(|e| format!("sauvegarde pdf: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn targets_image() {
        let t = convert_targets("/x/photo.png".into());
        assert!(t.contains(&"pdf".to_string()));
        assert!(t.contains(&"jpg".to_string()));
        assert!(!t.contains(&"png".to_string()));
    }

    #[test]
    fn targets_office_pdf_only() {
        assert_eq!(convert_targets("/x/rapport.xlsx".into()), vec!["pdf".to_string()]);
    }

    #[test]
    fn targets_unknown_empty() {
        assert!(convert_targets("/x/bin.dat".into()).is_empty());
    }

    #[test]
    fn out_path_avoids_collision() {
        let dir = std::env::temp_dir().join(format!("vela_conv_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let base = dir.join("a.png");
        std::fs::write(&base, b"x").unwrap();
        let taken = dir.join("a.jpg");
        std::fs::write(&taken, b"x").unwrap();
        let out = out_path(base.to_str().unwrap(), "jpg");
        assert_eq!(out.file_name().unwrap().to_str().unwrap(), "a (1).jpg");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
