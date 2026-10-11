// Prevent an additional console window from opening
// when the Windows production application starts.
#![cfg_attr(
    not(debug_assertions),
    windows_subsystem = "windows"
)]

fn main() {
    shopcore_desktop_lib::run();
}