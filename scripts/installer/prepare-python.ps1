# Build on Windows x64 with actions/setup-python (python-version: '3.12', architecture: 'x64').
# Example: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer/prepare-python.ps1
[CmdletBinding()]
param(
    [string]$OutputDirectory = "",
    [string]$HostPython = "python"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ($env:OS -ne "Windows_NT") {
    throw "Portable Python must be prepared and smoke-tested on Windows x64."
}

$repository = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$requirements = Join-Path $repository "config/installer-python-requirements.txt"
$checker = Join-Path $PSScriptRoot "check-python.py"
$scripts = Join-Path $repository "scripts"
if (-not (Test-Path -LiteralPath $requirements -PathType Leaf)) { throw "Installer Python requirements are missing." }
if (-not (Test-Path -LiteralPath $checker -PathType Leaf)) { throw "Installer Python checker is missing." }

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $repository "build/installer/python"
}
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) {
    $item = Get-Item -LiteralPath $output -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        throw "OutputDirectory must be a regular, empty build directory."
    }
    if (Get-ChildItem -LiteralPath $output -Force | Select-Object -First 1) {
        throw "OutputDirectory is not empty. Choose a new build directory; existing files will not be removed."
    }
}

& $HostPython -I -c "import platform, struct, sys; assert sys.version_info[:2] == (3, 12), 'Host Python must be 3.12'; assert sys.platform == 'win32' and struct.calcsize('P') == 8 and platform.machine().lower() in ('amd64', 'x86_64'), 'Host Python must be Windows x64'; print('Build host:', sys.version)"
if ($LASTEXITCODE -ne 0) { throw "Host Python validation failed (exit $LASTEXITCODE)." }

# Downloaded from the official release URL over verified HTTPS; SHA-256 verified
# during implementation. Never execute an archive whose hash does not match.
$downloadUrl = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip"
$expectedSha256 = "4acbed6dd1c744b0376e3b1cf57ce906f9dc9e95e68824584c8099a63025a3c3"
$parent = [System.IO.Path]::GetDirectoryName($output)
New-Item -ItemType Directory -Path $parent -Force | Out-Null
$staging = Join-Path $parent (".ktp-python-build-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging | Out-Null

try {
    $archive = Join-Path $staging "python.zip"
    $runtime = Join-Path $staging "python"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archive -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 120
    $actualSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    if (-not [string]::Equals($actualSha256, $expectedSha256, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Official Python archive SHA-256 mismatch; refusing to extract."
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $runtime
    $sitePackages = Join-Path $runtime "Lib/site-packages"
    New-Item -ItemType Directory -Path $sitePackages -Force | Out-Null
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines((Join-Path $runtime "python312._pth"),
        [string[]]@("python312.zip", ".", "Lib", "Lib/site-packages", "import site"), $utf8)

    # --isolated ignores developer pip configuration; wheels come from PyPI.
    # Host Python is only a build prerequisite. The target never needs pip.
    & $HostPython -I -m pip --isolated --disable-pip-version-check install --only-binary=:all: --no-compile --index-url https://pypi.org/simple --target $sitePackages -r $requirements
    if ($LASTEXITCODE -ne 0) { throw "Installer Python dependency installation failed (exit $LASTEXITCODE)." }

    # ONNX Runtime needs the MSVC C++ libraries in addition to CPython's own
    # runtime DLLs. Copy the pinned wheel's app-local files beside python.exe;
    # no machine-wide redistributable installation or administrator is needed.
    $runtimeDlls = Get-ChildItem -LiteralPath $sitePackages -Filter "*.dll" -Recurse |
        Where-Object { $_.Name -match '^(concrt|msvcp|vcruntime|vcamp|vcomp|vccorlib)140(_[a-zA-Z0-9_]+)?\.dll$' } |
        Group-Object Name
    foreach ($group in $runtimeDlls) {
        Copy-Item -LiteralPath $group.Group[0].FullName -Destination (Join-Path $runtime $group.Name) -Force
    }
    foreach ($dll in @("msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll")) {
        if (-not (Test-Path -LiteralPath (Join-Path $runtime $dll) -PathType Leaf)) {
            throw "Missing app-local MSVC runtime DLL: $dll"
        }
    }

    $embeddedPython = Join-Path $runtime "python.exe"
    & $embeddedPython $checker --embedded --scripts-directory $scripts
    if ($LASTEXITCODE -ne 0) { throw "Portable Python offline smoke test failed (exit $LASTEXITCODE)." }

    $manifest = [ordered]@{
        pythonVersion = "3.12.10"
        architecture = "win_amd64"
        sourceUrl = $downloadUrl
        archiveSha256 = $expectedSha256
        requirementsSha256 = (Get-FileHash -LiteralPath $requirements -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    [System.IO.File]::WriteAllText((Join-Path $runtime "runtime-manifest.json"), ($manifest | ConvertTo-Json), $utf8)
    Copy-Item -LiteralPath $requirements -Destination (Join-Path $runtime "installer-requirements.txt")

    # Recheck immediately before publishing. Delete only a confirmed-empty
    # directory, without recursion, so concurrent/user-created data survives.
    if (Test-Path -LiteralPath $output) {
        $item = Get-Item -LiteralPath $output -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or
            (Get-ChildItem -LiteralPath $output -Force | Select-Object -First 1)) {
            throw "OutputDirectory changed during preparation; refusing to replace it."
        }
        [System.IO.Directory]::Delete($output, $false)
    }
    [System.IO.Directory]::Move($runtime, $output)
    Write-Host "Prepared and verified CPython 3.12.10 Windows x64: $output"
} finally {
    # This GUID directory is created exclusively by this invocation. Nothing
    # under the selected output directory is deleted on a failed build.
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
