// Empreintes de fichier (md5/sha1/sha256/blake3) calculées en une seule passe de lecture,
// et détection du type réel par magic bytes (crate infer) — indépendant de l'extension.
use md5::Md5;
use serde::Serialize;
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hashes {
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
    pub blake3: String,
}

#[tauri::command]
pub async fn file_hash(path: String) -> Result<Hashes, String> {
    tauri::async_runtime::spawn_blocking(move || hash_blocking(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn hash_blocking(path: &str) -> Result<Hashes, String> {
    let file = File::open(path).map_err(|e| format!("ouverture : {e}"))?;
    let mut reader = BufReader::new(file);
    let mut md5 = Md5::new();
    let mut sha1 = Sha1::new();
    let mut sha256 = Sha256::new();
    let mut b3 = blake3::Hasher::new();
    let mut buf = [0u8; 1 << 16];
    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("lecture : {e}"))?;
        if n == 0 {
            break;
        }
        md5.update(&buf[..n]);
        sha1.update(&buf[..n]);
        sha256.update(&buf[..n]);
        b3.update(&buf[..n]);
    }
    Ok(Hashes {
        md5: hex::encode(md5.finalize()),
        sha1: hex::encode(sha1.finalize()),
        sha256: hex::encode(sha256.finalize()),
        blake3: b3.finalize().to_hex().to_string(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileKind {
    pub mime: Option<String>,
    pub ext: Option<String>,
}

#[tauri::command]
pub fn file_kind(path: String) -> Result<FileKind, String> {
    match infer::get_from_path(&path).map_err(|e| e.to_string())? {
        Some(t) => Ok(FileKind {
            mime: Some(t.mime_type().to_string()),
            ext: Some(t.extension().to_string()),
        }),
        None => Ok(FileKind { mime: None, ext: None }),
    }
}
