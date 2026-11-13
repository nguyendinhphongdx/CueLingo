//! Microphone consent as Windows stores it (Settings → Privacy & security → Microphone).
//! A desktop app is blocked when either the global switch or the "desktop apps" switch is off.

/// `granted`, `denied` or `undetermined`, the values the app's `PermissionState` accepts.
pub fn microphone() -> &'static str {
    from_values(read("microphone"), read("microphone\\NonPackaged"))
}

/// Combines the global consent value and the one for desktop (non-packaged) apps.
pub fn from_values(global: Option<String>, desktop: Option<String>) -> &'static str {
    let denied = |v: &Option<String>| v.as_deref() == Some("Deny");
    if denied(&global) || denied(&desktop) {
        return "denied";
    }
    match global.as_deref() {
        Some("Allow") => "granted",
        _ => "undetermined",
    }
}

#[cfg(windows)]
fn read(key: &str) -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let path = format!(
        "Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\{key}"
    );
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(path)
        .ok()?
        .get_value::<String, _>("Value")
        .ok()
}

#[cfg(not(windows))]
fn read(_key: &str) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::from_values;

    fn s(v: &str) -> Option<String> {
        Some(v.to_string())
    }

    #[test]
    fn allowed_everywhere_is_granted() {
        assert_eq!(from_values(s("Allow"), s("Allow")), "granted");
        assert_eq!(from_values(s("Allow"), None), "granted");
    }

    #[test]
    fn either_switch_off_is_denied() {
        assert_eq!(from_values(s("Deny"), s("Allow")), "denied");
        assert_eq!(from_values(s("Allow"), s("Deny")), "denied");
    }

    #[test]
    fn nothing_recorded_is_undetermined() {
        assert_eq!(from_values(None, None), "undetermined");
    }
}
