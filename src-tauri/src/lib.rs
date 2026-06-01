// Point d'entrée Tauri : enregistre les commandes filesystem exposées au front.
mod apps;
mod archive;
mod favorites;
mod fs_ops;
mod places;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(archive::ExtractionManager::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fs_ops::list_dir,
            fs_ops::read_file,
            fs_ops::read_file_chunk,
            fs_ops::write_file,
            fs_ops::rename_entry,
            fs_ops::delete_entry,
            fs_ops::create_dir,
            fs_ops::search_dir,
            fs_ops::read_file_base64,
            fs_ops::open_native,
            fs_ops::move_entry,
            fs_ops::get_entry_props,
            places::home_dir,
            places::list_places,
            favorites::load_favorites,
            favorites::save_favorites,
            archive::list_archive,
            archive::start_extraction,
            archive::extraction_pause,
            archive::extraction_resume,
            archive::extraction_cancel,
            archive::extraction_provide_password,
            apps::get_apps_for_file,
            apps::search_path_bins,
            apps::set_default_app,
            apps::set_custom_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
