from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(SPEC).resolve().parent

a = Analysis(
    [str(ROOT / "server" / "desktop.py")],
    pathex=[str(ROOT / "server")],
    binaries=[],
    datas=[
        (str(ROOT / "client" / "dist"), "client_dist"),
        (str(ROOT / "server" / "app" / "migrations"), "app/migrations"),
    ],
    hiddenimports=collect_submodules("uvicorn"),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Taskamina",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)