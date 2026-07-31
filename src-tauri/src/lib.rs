#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    let application =
        tauri::Builder::default()
            .setup(|app| {
                if cfg!(debug_assertions) {
                    app.handle().plugin(
                        tauri_plugin_log::Builder::default()
                            .level(
                                log::LevelFilter::Info,
                            )
                            .build(),
                    )?;
                }

                log::info!(
                    "ShopCore desktop runtime initialized"
                );

                Ok(())
            });

    application
        .run(tauri::generate_context!())
        .expect(
            "ShopCore desktop application failed to start",
        );
}