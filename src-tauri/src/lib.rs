// Point d'entrée Tauri : enregistre les commandes filesystem exposées au front.
mod apps;
mod archive;
mod favorites;
mod fs_ops;
mod ops;
mod places;
mod terminal;
mod thumbs;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(archive::ExtractionManager::new())
        .manage(watcher::DirWatcher::new())
        .manage(ops::TransferManager::new())
        .manage(terminal::TerminalManager::new())
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
            ops::trash_entries,
            ops::delete_entries,
            ops::copy_entries,
            ops::move_entries,
            ops::transfer_pause,
            ops::transfer_resume,
            ops::transfer_cancel,
            ops::create_archive,
            ops::search_content,
            ops::trash_dir,
            ops::trash_count,
            ops::empty_trash,
            watcher::watch_dir,
            thumbs::thumbnail,
            terminal::available_shells,
            terminal::term_open,
            terminal::term_input,
            terminal::term_resize,
            terminal::term_close,
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
