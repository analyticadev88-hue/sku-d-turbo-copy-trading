"""Terminal provisioning and launching for the SkuD multi-account bridge.

Stdlib only. Owns everything that touches the Windows MT5 terminals:
terminal slot assignment, startup.ini auto-login,
EA/chart-profile installation, process launching, and running-login detection.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path

TERMINALS_DIR = Path(os.environ.get("SKUD_TERMINALS_DIR", r"C:\skud\terminals"))
MENTOR_BRIDGE_KEY = os.environ.get("SKUD_BRIDGE_KEY", "")
TERMINAL_MASTER = os.environ.get("SKUD_TERMINAL_MASTER", r"C:\skud\mt5-master")
LAUNCH_STAGGER_SEC = float(os.environ.get("SKUD_LAUNCH_STAGGER_SEC", "5"))


def _decode_text(raw: bytes) -> tuple[str, str]:
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    elif raw.startswith(b"\xef\xbb\xbf"):
        encoding = "utf-8-sig"
    elif b"\x00" in raw[:200]:
        encoding = "utf-16-le"
    else:
        encoding = "utf-8"
    try:
        return raw.decode(encoding), encoding
    except UnicodeDecodeError as error:
        fallback = "mbcs" if os.name == "nt" else "cp1252"
        if encoding != fallback:
            try:
                return raw.decode(fallback), fallback
            except UnicodeDecodeError:
                pass
        raise ValueError(f"Could not decode MT5 configuration using {encoding} or {fallback}.") from error


def _read_text_any_encoding(raw: bytes) -> str:
    """Decode .chr/.ini-style bytes while retaining their detected encoding."""
    try:
        return _decode_text(raw)[0]
    except ValueError:
        return ""


def _discover_ea(expert_name: str) -> str:
    """Locate a compiled EA inside the master terminal's Experts folder."""
    candidate = Path(TERMINAL_MASTER) / "MQL5" / "Experts" / f"{expert_name}.ex5"
    return str(candidate) if candidate.exists() else ""


def _discover_chart_template(expert_name: str, preferred_profile: str = "") -> str:
    """Find a saved chart profile that has the given EA attached.

    Scans the master terminal's Profiles/Charts folders so the SKUD_*_CHART_TEMPLATE
    variables only need to be set to override what the bridge finds on its own.
    """
    charts_root = Path(TERMINAL_MASTER) / "MQL5" / "Profiles" / "Charts"
    if not charts_root.is_dir():
        return ""
    matches: list[Path] = []
    for chart in sorted(charts_root.glob("*/*.chr")):
        try:
            text = _read_text_any_encoding(chart.read_bytes())
        except OSError:
            continue
        if expert_name in text:
            matches.append(chart)
    if preferred_profile:
        for chart in matches:
            if chart.parent.name.casefold() == preferred_profile.casefold():
                return str(chart)
    return str(matches[0]) if matches else ""


def _resolve_env_path(name: str, discovered: str) -> str:
    """Env var wins only when it points at a real file; otherwise use discovery.

    This keeps a mangled or stale setx value from shadowing a good auto-discovery.
    """
    configured = os.environ.get(name) or ""
    if configured and Path(configured).exists():
        return configured
    return discovered


EA_SOURCE = _resolve_env_path("SKUD_EA_SOURCE", _discover_ea("SkuDTurboStudentEA"))
CHART_TEMPLATE = _resolve_env_path(
    "SKUD_CHART_TEMPLATE", _discover_chart_template("SkuDTurboStudentEA", "SkuD")
)
MENTOR_EA_SOURCE = _resolve_env_path("SKUD_MENTOR_EA_SOURCE", _discover_ea("SkuDTurboMentorEA"))
MENTOR_CHART_TEMPLATE = _resolve_env_path(
    "SKUD_MENTOR_CHART_TEMPLATE", _discover_chart_template("SkuDTurboMentorEA", "Mentor")
)

if EA_SOURCE:
    print(f"SkuD terminal manager: student EA = {EA_SOURCE}")
if CHART_TEMPLATE:
    print(f"SkuD terminal manager: student chart = {CHART_TEMPLATE}")
if MENTOR_EA_SOURCE:
    print(f"SkuD terminal manager: mentor EA = {MENTOR_EA_SOURCE}")
if MENTOR_CHART_TEMPLATE:
    print(f"SkuD terminal manager: mentor chart = {MENTOR_CHART_TEMPLATE}")

_running_cache: tuple[set[str], float] = (set(), 0.0)
_running_lock = threading.Lock()
_last_launch = 0.0
_launch_lock = threading.Lock()


def normalize_folder(path: str) -> str:
    return str(Path(path)).replace("/", "\\").rstrip("\\").lower()


def running_logins(ttl: float = 10.0) -> set[str]:
    """Logins of MT5 terminals currently running, read from each terminal's startup.ini."""
    global _running_cache
    now = time.time()
    with _running_lock:
        cached, cached_at = _running_cache
        if now - cached_at < ttl:
            return set(cached)
    ps_cmd = (
        "Get-CimInstance Win32_Process -Filter \"name='terminal64.exe'\" | ForEach-Object { "
        "$folder = Split-Path $_.ExecutablePath -Parent; "
        "$ini = Join-Path $folder 'startup.ini'; "
        "if (Test-Path $ini) { "
        "$m = (Get-Content $ini -Raw | Select-String 'Login=(\\d+)').Matches; "
        "if ($m) { $m.Groups[1].Value } } }"
    )
    logins: set[str] = set()
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=15,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.isdigit():
                logins.add(line)
    except Exception:
        logins = set()
    with _running_lock:
        _running_cache = (logins, now)
    return set(logins)


def stop_managed_terminals(timeout_sec: int = 15) -> None:
    """Close terminals launched from the managed SkuD slots directory only."""
    root = str(TERMINALS_DIR.resolve()).replace("'", "''").rstrip("\\") + "\\"
    ps_cmd = (
        f"$root = '{root}'; "
        "$items = Get-CimInstance Win32_Process -Filter \"name='terminal64.exe'\" | "
        "Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) }; "
        "foreach ($item in $items) { "
        "$process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue; "
        "if ($process) { [void]$process.CloseMainWindow(); "
        f"if (-not $process.WaitForExit({int(timeout_sec) * 1000})) {{ $process.Kill(); $process.WaitForExit() }} "
        "} } "
        "$remaining = Get-CimInstance Win32_Process -Filter \"name='terminal64.exe'\" | "
        "Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) }; "
        "if ($remaining) { $remaining | ForEach-Object { $_.ExecutablePath }; exit 1 }"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
        capture_output=True,
        text=True,
        timeout=timeout_sec + 15,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stdout.strip() or result.stderr.strip() or "Could not close every managed MT5 terminal.")
    global _running_cache
    with _running_lock:
        _running_cache = (set(), 0.0)


def stop_account_terminal(folder_path: str, timeout_sec: int = 15) -> None:
    """Close the MT5 process running from one managed account folder."""
    folder = str(Path(folder_path).resolve()).replace("'", "''").rstrip("\\")
    ps_cmd = (
        f"$folder = '{folder}'; "
        "$items = Get-CimInstance Win32_Process -Filter \"name='terminal64.exe'\" | "
        "Where-Object { $_.ExecutablePath -and "
        "[String]::Equals((Split-Path $_.ExecutablePath -Parent), $folder, [StringComparison]::OrdinalIgnoreCase) }; "
        "foreach ($item in $items) { "
        "$process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue; "
        "if ($process) { [void]$process.CloseMainWindow(); "
        f"if (-not $process.WaitForExit({int(timeout_sec) * 1000})) {{ $process.Kill(); $process.WaitForExit() }} "
        "} } "
        "$remaining = Get-CimInstance Win32_Process -Filter \"name='terminal64.exe'\" | "
        "Where-Object { $_.ExecutablePath -and "
        "[String]::Equals((Split-Path $_.ExecutablePath -Parent), $folder, [StringComparison]::OrdinalIgnoreCase) }; "
        "if ($remaining) { $remaining | ForEach-Object { $_.ExecutablePath }; exit 1 }"
    )
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
        capture_output=True,
        text=True,
        timeout=timeout_sec + 15,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stdout.strip() or result.stderr.strip() or "Could not close the account MT5 terminal.")
    global _running_cache
    with _running_lock:
        _running_cache = (set(), 0.0)


def assign_slot(used_folders: set[str]) -> Path:
    """Find a terminal folder for a new account: reuse a free existing slot, else clone the master."""
    used = {normalize_folder(folder) for folder in used_folders}
    if TERMINALS_DIR.exists():
        for slot in sorted(TERMINALS_DIR.iterdir()):
            if slot.is_dir() and (slot / "terminal64.exe").exists() and normalize_folder(str(slot)) not in used:
                return slot
    master = Path(TERMINAL_MASTER) if TERMINAL_MASTER else None
    if not master or not (master / "terminal64.exe").exists():
        raise RuntimeError(
            "No free terminal slot and SKUD_TERMINAL_MASTER is not configured to a folder "
            "containing terminal64.exe. Seed the master terminal first."
        )
    TERMINALS_DIR.mkdir(parents=True, exist_ok=True)
    existing = {p.name for p in TERMINALS_DIR.iterdir() if p.is_dir()}
    index = 1
    while f"Slot{index:03d}" in existing:
        index += 1
    target = TERMINALS_DIR / f"Slot{index:03d}"
    shutil.copytree(master, target, ignore=shutil.ignore_patterns("startup.ini"))
    return target


def sync_chart_inputs(chart_path: Path, replacements: dict[str, str]) -> None:
    """Rewrite KEY=value lines inside a chart profile, preserving its encoding.

    Chart profiles persist the expert's input values, so a stale value saved in
    the template would override the EA's compiled default — e.g. a stale EaToken
    would get every request from that terminal rejected with 401 regardless of
    which MT5 server the account logs in to. Rewriting the lines at launch makes
    the inputs independent of the server and of whatever value was last saved in
    the chart.

    MT5 writes .chr files as UTF-16, so the encoding must be detected before
    editing; a plain text search would silently match nothing. Only lines that
    already exist are rewritten; missing keys are not added.
    """
    if not replacements or not chart_path.exists():
        return
    try:
        raw = chart_path.read_bytes()
    except OSError:
        return
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        encoding = "utf-16"
    elif raw.startswith(b"\xef\xbb\xbf"):
        encoding = "utf-8-sig"
    elif b"\x00" in raw[:200]:
        encoding = "utf-16-le"
    else:
        encoding = "utf-8"
    try:
        text = raw.decode(encoding)
    except (UnicodeDecodeError, ValueError):
        return
    if not any(key + "=" in text for key in replacements):
        return
    updated = text
    if "BridgeKey" in replacements and "BridgeKey=" not in updated:
        updated = re.sub(
            r"(?m)^MentorToken=.*$",
            lambda _: "BridgeKey=" + replacements["BridgeKey"],
            updated,
        )
    for key, value in replacements.items():
        updated = re.sub(r"(?m)^" + re.escape(key) + r"=.*$", key + "=" + value, updated)
    if updated != text:
        try:
            chart_path.write_bytes(updated.encode(encoding))
        except (OSError, UnicodeError):
            pass


def _chart_profile_name(template_path: str) -> str:
    """Chart profile folder a template belongs to, e.g. 'SkuD' or 'Mentor'.

    The terminal is launched with /profile:<name> so MT5 always opens THIS
    profile's charts instead of restoring whatever profile happened to be
    active when the master terminal was last closed.
    """
    if not template_path:
        return ""
    return Path(template_path).parent.name or "Default"


_WEBREQUEST_SETTING_KEYS = {"allowwebrequest", "webrequest", "webrequesturl"}


def _expert_webrequest_settings(text: str) -> list[tuple[str, str]]:
    settings: list[tuple[str, str]] = []
    in_experts = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            in_experts = stripped[1:-1].strip().casefold() == "experts"
            continue
        if not in_experts or not stripped or stripped.startswith((";", "#")) or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key.strip().casefold() in _WEBREQUEST_SETTING_KEYS:
            settings.append((key.strip(), value.strip()))
    return settings


def _merge_expert_webrequest_settings(text: str, settings: list[tuple[str, str]]) -> str:
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines(keepends=True)
    section_start = None
    section_end = len(lines)
    in_experts = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            if in_experts:
                section_end = index
                break
            in_experts = stripped[1:-1].strip().casefold() == "experts"
            if in_experts:
                section_start = index

    setting_lines = [f"{key}={value}{newline}" for key, value in settings]
    if section_start is None:
        separator = "" if not text or text.endswith(("\n", "\r")) else newline
        return f"{text}{separator}[Experts]{newline}{''.join(setting_lines)}"

    retained = [
        line for line in lines[section_start + 1:section_end]
        if not (
            "=" in line and
            line.split("=", 1)[0].strip().casefold() in _WEBREQUEST_SETTING_KEYS
        )
    ]
    if retained and not retained[-1].endswith(("\n", "\r")):
        retained[-1] += newline
    return "".join(
        lines[:section_start + 1] + retained + setting_lines + lines[section_end:]
    )


def sync_master_webrequest_settings(
    folder: Path,
) -> tuple[Path, Path, list[tuple[str, str]]]:
    """Copy the master terminal's Expert Advisors WebRequest settings to a slot."""
    relative_paths = (
        Path("Config") / "common.ini",
        Path("config") / "common.ini",
        Path("Config") / "terminal.ini",
        Path("config") / "terminal.ini",
    )
    source_path = None
    settings: list[tuple[str, str]] = []
    incomplete_path = None
    for relative_path in relative_paths:
        candidate = Path(TERMINAL_MASTER) / relative_path
        if not candidate.is_file():
            continue
        try:
            text, _ = _decode_text(candidate.read_bytes())
        except (OSError, ValueError) as exc:
            raise RuntimeError(f"Could not read master MT5 settings file {candidate}: {exc}") from exc
        candidate_settings = _expert_webrequest_settings(text)
        if candidate_settings:
            enabled = any(
                key.casefold() in {"webrequest", "allowwebrequest"} and value.casefold() in {"1", "true"}
                for key, value in candidate_settings
            )
            has_urls = any(
                key.casefold() == "webrequesturl" and value for key, value in candidate_settings
            )
            if enabled and has_urls:
                source_path = candidate
                settings = candidate_settings
                break
            if incomplete_path is None:
                incomplete_path = candidate
    if source_path is None:
        if incomplete_path is not None:
            raise RuntimeError(
                f"Master MT5 WebRequest settings in {incomplete_path} are incomplete. Enable WebRequest "
                "and add the bridge URLs in Tools > Options > Expert Advisors, then close MT5."
            )
        raise RuntimeError(
            "Master MT5 WebRequest settings were not found. Open the master terminal in "
            "portable mode, enable WebRequest in Tools > Options > Expert Advisors, add "
            "the required bridge URLs, and close MT5 before starting the bridge."
        )

    target_path = folder / source_path.relative_to(Path(TERMINAL_MASTER))
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.exists():
        target_raw = target_path.read_bytes()
        try:
            target_text, encoding = _decode_text(target_raw)
        except ValueError as exc:
            raise RuntimeError(f"Could not read MT5 settings file {target_path}: {exc}") from exc
        updated_text = _merge_expert_webrequest_settings(target_text, settings)
        if updated_text != target_text:
            target_path.write_bytes(updated_text.encode(encoding))
    else:
        shutil.copy2(source_path, target_path)

    try:
        synced_text, _ = _decode_text(target_path.read_bytes())
    except (OSError, ValueError) as exc:
        raise RuntimeError(f"Could not verify managed MT5 settings file {target_path}: {exc}") from exc
    if _expert_webrequest_settings(synced_text) != settings:
        raise RuntimeError(f"Managed MT5 WebRequest settings did not match the master in {target_path}.")
    return source_path, target_path, settings


def sync_chart_token(chart_path: Path) -> None:
    """Force the EA token stored inside a student chart profile to the configured key."""
    token = os.environ.get("SKUD_EA_TOKEN") or os.environ.get("SKUD_BRIDGE_KEY") or ""
    if token:
        sync_chart_inputs(chart_path, {"EaToken": token})


def ensure_terminal(account: dict) -> tuple[bool, str]:
    """Launch the terminal for an account row if it is not already running.

    Returns (success, message). Never raises; HTTP handlers turn failures into messages.
    """
    login = str(account["login"])
    folder = Path(account["folder_path"])
    exe = folder / "terminal64.exe"
    if not exe.exists():
        return False, f"terminal64.exe not found in {folder}"
    if login in running_logins():
        return True, "already running; restart the managed terminal to apply master MT5 setting changes"
    try:
        settings_source, settings_target, expert_settings = sync_master_webrequest_settings(folder)
    except (OSError, RuntimeError) as exc:
        return False, str(exc)[:300]
    role = str(account.get("role", "student") or "student")
    global _last_launch
    with _launch_lock:
        wait = LAUNCH_STAGGER_SEC - (time.time() - _last_launch)
        if wait > 0:
            time.sleep(wait)
        _last_launch = time.time()
    warnings: list[str] = []
    try:
        # MT5 parses startup.ini using the system ANSI codepage, so encode with
        # mbcs on Windows — ascii with errors="replace" would silently corrupt
        # any non-ASCII password character into "?" and the broker login fails.
        startup_encoding = "mbcs" if os.name == "nt" else "utf-8"
        startup_configuration = (
            f"[Common]\nLogin={login}\nPassword={account['password']}\n"
            f"Server={account['server']}\n[Experts]\n"
            + "".join(f"{key}={value}\n" for key, value in expert_settings)
        )
        (folder / "startup.ini").write_text(
            startup_configuration,
            encoding=startup_encoding,
        )
        if role == "mentor":
            _install_mentor_files(folder, account, warnings)
            profile = _chart_profile_name(MENTOR_CHART_TEMPLATE)
        else:
            _install_student_files(folder, warnings)
            profile = _chart_profile_name(CHART_TEMPLATE)
        launch_args = [str(exe), "/portable", f"/config:{folder / 'startup.ini'}"]
        if profile:
            launch_args.append(f"/profile:{profile}")
        subprocess.Popen(launch_args, cwd=str(folder), close_fds=True)
        print(
            f"SkuD MT5 WebRequest settings synced for login {login}: "
            f"{settings_source} -> {settings_target}"
        )
        return True, "; ".join(warnings) if warnings else "launched"
    except Exception as exc:
        return False, str(exc)[:200]


def _install_student_files(folder: Path, warnings: list[str]) -> None:
    if EA_SOURCE and Path(EA_SOURCE).exists():
        experts = folder / "MQL5" / "Experts"
        experts.mkdir(parents=True, exist_ok=True)
        shutil.copy2(EA_SOURCE, experts / Path(EA_SOURCE).name)
    else:
        warnings.append("EA source not configured; compile and copy the EA manually")
    if CHART_TEMPLATE and Path(CHART_TEMPLATE).exists():
        charts = folder / "MQL5" / "Profiles" / "Charts" / _chart_profile_name(CHART_TEMPLATE)
        charts.mkdir(parents=True, exist_ok=True)
        target_chart = charts / Path(CHART_TEMPLATE).name
        shutil.copy2(CHART_TEMPLATE, target_chart)
        sync_chart_token(target_chart)
    else:
        warnings.append("chart template not configured; attach the SkuD Student EA to a chart manually")


def _install_mentor_files(folder: Path, account: dict, warnings: list[str]) -> None:
    if MENTOR_EA_SOURCE and Path(MENTOR_EA_SOURCE).exists():
        experts = folder / "MQL5" / "Experts"
        experts.mkdir(parents=True, exist_ok=True)
        shutil.copy2(MENTOR_EA_SOURCE, experts / Path(MENTOR_EA_SOURCE).name)
    else:
        warnings.append("mentor EA source not configured; compile and copy the Mentor EA manually")
    if MENTOR_CHART_TEMPLATE and Path(MENTOR_CHART_TEMPLATE).exists():
        charts = folder / "MQL5" / "Profiles" / "Charts" / _chart_profile_name(MENTOR_CHART_TEMPLATE)
        charts.mkdir(parents=True, exist_ok=True)
        target_chart = charts / Path(MENTOR_CHART_TEMPLATE).name
        shutil.copy2(MENTOR_CHART_TEMPLATE, target_chart)
        replacements: dict[str, str] = {"BridgeKey": MENTOR_BRIDGE_KEY}
        mentor_meta = account.get("mentor_meta") or {}
        mentor_id = str(mentor_meta.get("mentor_id", "") or "")
        mentor_name = str(mentor_meta.get("mentor_name", "") or "")
        if mentor_id:
            replacements["MentorId"] = mentor_id
        if mentor_name:
            replacements["MentorName"] = mentor_name
        sync_chart_inputs(target_chart, replacements)
    else:
        warnings.append("mentor chart template not configured; attach the SkuD Mentor EA to a chart manually")


def clear_account_charts(folder_path: str) -> None:
    """Wipe saved chart profiles/workspaces from a managed slot.

    Called when an account disconnects: MT5 otherwise restores the previous
    account's chart and EA input settings on the next launch, so a new login
    would inherit the old login's chart state. The next launch reinstalls a
    fresh chart from the template anyway.
    """
    shutil.rmtree(Path(folder_path) / "MQL5" / "Profiles" / "Charts", ignore_errors=True)
