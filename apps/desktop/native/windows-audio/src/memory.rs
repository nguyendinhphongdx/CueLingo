//! Peak memory of this process, for the `--bench` line (plan spike S2: RAM <= 1.5 GB).

/// Peak working set in MB on Windows; `None` elsewhere (measure with `/usr/bin/time -l` on a Mac).
#[cfg(windows)]
pub fn peak_working_set_mb() -> Option<f64> {
    use windows_sys::Win32::System::ProcessStatus::{
        GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS,
    };
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    // SAFETY: a zeroed counters struct of the size we pass is what the call fills in; the pseudo handle of
    // the current process needs no closing.
    unsafe {
        let mut counters: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
        counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        if GetProcessMemoryInfo(GetCurrentProcess(), &mut counters, counters.cb) == 0 {
            return None;
        }
        Some(counters.PeakWorkingSetSize as f64 / (1024.0 * 1024.0))
    }
}

#[cfg(not(windows))]
pub fn peak_working_set_mb() -> Option<f64> {
    None
}
