//! Sign-in plumbing: the `cuelingo://auth?code=…` link the web hand-off page opens, and the device
//! token kept in the macOS Keychain (never in a file or in the webview's storage).
use tauri::{AppHandle, Emitter};

const SERVICE: &str = "vn.cmcai.cuelingo";
const ACCOUNT: &str = "device-token";

/// The one-time code from a `cuelingo://auth?code=…` link; anything else is ignored.
pub fn code_from_url(url: &str) -> Option<String> {
    let rest = url.strip_prefix("cuelingo://auth")?;
    let query = rest.strip_prefix('?')?;
    query
        .split('&')
        .find_map(|pair| pair.strip_prefix("code="))
        .filter(|code| {
            (20..=200).contains(&code.len())
                && code
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        })
        .map(str::to_string)
}

/// Hands a received link to the webview as an `auth-code` event.
pub fn handle_url(app: &AppHandle, url: &str) {
    if let Some(code) = code_from_url(url) {
        crate::windows::show_main(app);
        let _ = app.emit("auth-code", code);
    }
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn auth_token_get() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn auth_token_set(token: String) -> Result<(), String> {
    entry()?.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn auth_token_clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODE: &str = "abcdefghijklmnopqrstuvwxyz0123456789_-ABC";

    #[test]
    fn reads_the_code_from_an_auth_link() {
        assert_eq!(
            code_from_url(&format!("cuelingo://auth?code={CODE}")),
            Some(CODE.to_string())
        );
        assert_eq!(
            code_from_url(&format!("cuelingo://auth?x=1&code={CODE}")),
            Some(CODE.to_string())
        );
    }

    #[test]
    fn ignores_other_links_and_bad_codes() {
        assert_eq!(code_from_url("https://example.com/auth?code=abc"), None);
        assert_eq!(
            code_from_url("cuelingo://other?code=abcdefghijklmnopqrstuvwxyz"),
            None
        );
        assert_eq!(code_from_url("cuelingo://auth?code=short"), None);
        assert_eq!(code_from_url("cuelingo://auth"), None);
        assert_eq!(
            code_from_url("cuelingo://auth?code=abcdefghijklmnopqrstuvwxyz%2F%3Cscript%3E"),
            None
        );
    }
}
