// Boîte à outils PDF (F12) — cœur 100 % Rust pur via lopdf : fusion, extraction de pages, rotation.
// Compression/filigrane/protection (binaires optionnels) viendront en complément. Non-destructif : écrit
// toujours un nouveau fichier, jamais l'original.
use lopdf::dictionary;
use lopdf::{Document, Object, ObjectId};
use std::collections::BTreeMap;
use std::path::Path;

// Renvoie un chemin de sortie libre dérivé du premier fichier (`_merged`, `_pages`, `_rotated`).
fn out_path(src: &str, suffix: &str) -> String {
    let p = Path::new(src);
    let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "sortie".into());
    let parent = p.parent().unwrap_or(Path::new("."));
    let mut candidate = parent.join(format!("{stem}{suffix}.pdf"));
    let mut i = 1;
    while candidate.exists() {
        candidate = parent.join(format!("{stem}{suffix} ({i}).pdf"));
        i += 1;
    }
    candidate.to_string_lossy().to_string()
}

// Analyse "1-3,7,10-" en numéros de page 1-indexés, bornés à `total`.
fn parse_ranges(spec: &str, total: u32) -> Vec<u32> {
    let mut out = Vec::new();
    for part in spec.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((a, b)) = part.split_once('-') {
            let start: u32 = a.trim().parse().unwrap_or(1);
            let end: u32 = b.trim().parse().unwrap_or(total);
            for n in start..=end.min(total) {
                if n >= 1 {
                    out.push(n);
                }
            }
        } else if let Ok(n) = part.parse::<u32>() {
            if n >= 1 && n <= total {
                out.push(n);
            }
        }
    }
    out.sort_unstable();
    out.dedup();
    out
}

#[tauri::command]
pub fn pdf_extract_pages(path: String, ranges: String) -> Result<String, String> {
    let mut doc = Document::load(&path).map_err(|e| format!("PDF illisible : {e}"))?;
    let total = doc.get_pages().len() as u32;
    let keep = parse_ranges(&ranges, total);
    if keep.is_empty() {
        return Err("aucune page valide dans la plage".into());
    }
    let to_delete: Vec<u32> = (1..=total).filter(|n| !keep.contains(n)).collect();
    doc.delete_pages(&to_delete);
    let out = out_path(&path, "_pages");
    doc.save(&out).map_err(|e| e.to_string())?;
    Ok(out)
}

#[tauri::command]
pub fn pdf_rotate(path: String, degrees: i64) -> Result<String, String> {
    let mut doc = Document::load(&path).map_err(|e| format!("PDF illisible : {e}"))?;
    let pages = doc.get_pages();
    for (_, oid) in pages {
        if let Ok(page) = doc.get_object_mut(oid) {
            if let Ok(dict) = page.as_dict_mut() {
                let current = dict.get(b"Rotate").and_then(|o| o.as_i64()).unwrap_or(0);
                let next = ((current + degrees) % 360 + 360) % 360;
                dict.set("Rotate", Object::Integer(next));
            }
        }
    }
    let out = out_path(&path, "_rotated");
    doc.save(&out).map_err(|e| e.to_string())?;
    Ok(out)
}

// Fusionne plusieurs PDF dans l'ordre fourni (recette lopdf : renumérotation puis reconstruction du catalogue).
#[tauri::command]
pub fn pdf_merge(paths: Vec<String>, dest: String) -> Result<String, String> {
    if paths.len() < 2 {
        return Err("au moins deux PDF requis".into());
    }
    let mut max_id = 1u32;
    let mut pages_map: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut objects_map: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut target = Document::with_version("1.5");

    for path in &paths {
        let mut doc = Document::load(path).map_err(|e| format!("{path} illisible : {e}"))?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;
        pages_map.extend(doc.get_pages().into_iter().filter_map(|(_, oid)| {
            doc.get_object(oid).ok().map(|obj| (oid, obj.clone()))
        }));
        objects_map.extend(doc.objects);
    }

    // Réinjecte tous les objets sauf Catalog/Pages (reconstruits), et les pages réparentées.
    let mut page_ids: Vec<ObjectId> = Vec::new();
    for (oid, obj) in &objects_map {
        match obj.type_name().unwrap_or("") {
            "Catalog" | "Pages" | "Outlines" | "Outline" => {}
            _ => {
                target.objects.insert(*oid, obj.clone());
            }
        }
    }

    let pages_id = target.new_object_id();
    for (oid, page) in &pages_map {
        if let Ok(dict) = page.as_dict() {
            let mut d = dict.clone();
            d.set("Parent", pages_id);
            target.objects.insert(*oid, Object::Dictionary(d));
            page_ids.push(*oid);
        }
    }

    let pages_dict = dictionary! {
        "Type" => "Pages",
        "Count" => page_ids.len() as i64,
        "Kids" => page_ids.iter().map(|id| Object::Reference(*id)).collect::<Vec<_>>(),
    };
    target.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let catalog_id = target.new_object_id();
    let catalog = dictionary! { "Type" => "Catalog", "Pages" => pages_id };
    target.objects.insert(catalog_id, Object::Dictionary(catalog));
    target.trailer.set("Root", catalog_id);
    target.max_id = max_id;

    let out = if dest.trim().is_empty() { out_path(&paths[0], "_merged") } else { dest };
    target.save(&out).map_err(|e| e.to_string())?;
    Ok(out)
}
