mod apps;
mod cleanup;
mod updates;

pub use cleanup::run_elevated_delete;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            apps::list_installed_apps,
            apps::uninstall_app,
            apps::open_install_location,
            updates::list_updates,
            updates::update_app,
            cleanup::scan_residuals,
            cleanup::delete_residuals,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
