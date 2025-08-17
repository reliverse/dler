Write-Host "Setting up Visual Studio Build Tools environment..." -ForegroundColor Green

# Try to find and set up Visual Studio Build Tools
$vsPaths = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
    "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools", 
    "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools"
)

$vcvarsPath = $null
foreach ($path in $vsPaths) {
    $testPath = Join-Path $path "VC\Auxiliary\Build\vcvars64.bat"
    if (Test-Path $testPath) {
        $vcvarsPath = $testPath
        Write-Host "Found VS Build Tools at: $path" -ForegroundColor Yellow
        break
    }
}

if ($vcvarsPath) {
    Write-Host "Setting up environment..." -ForegroundColor Yellow
    
    # Create a temporary batch file to capture environment variables
    $tempBatch = [System.IO.Path]::GetTempFileName() + ".bat"
    @"
@echo off
call "$vcvarsPath"
set > "$tempBatch"
"@ | Out-File -FilePath $tempBatch -Encoding ASCII
    
    # Execute the batch file
    cmd /c $tempBatch
    
    # Read the environment variables
    $envVars = Get-Content $tempBatch | Where-Object { $_ -match "^([^=]+)=(.*)$" } | ForEach-Object {
        $matches[1], $matches[2] -join "="
    }
    
    # Clean up
    Remove-Item $tempBatch -ErrorAction SilentlyContinue
    
    # Set environment variables in current session
    foreach ($var in $envVars) {
        if ($var -match "^([^=]+)=(.*)$") {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    
    Write-Host "Environment set up complete" -ForegroundColor Green
    Write-Host "PATH now includes Visual Studio tools" -ForegroundColor Yellow
    
}
else {
    Write-Host "Visual Studio Build Tools not found in standard locations" -ForegroundColor Red
    Write-Host "Please ensure you have the C++ build tools workload installed" -ForegroundColor Red
    Write-Host "`nInstallation options:" -ForegroundColor Yellow
    Write-Host "1. Fastest: winget install Microsoft.VisualStudio.2022.BuildTools" -ForegroundColor Cyan
    Write-Host "2. Manual: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022" -ForegroundColor Cyan
    Write-Host "3. Visual Studio Installer: Start-Process 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe'" -ForegroundColor Cyan
    Write-Host "`nAfter installation, select 'C++ build tools' workload" -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "`nBuilding for current platform..." -ForegroundColor Green
cargo build --release

Write-Host "`nBuilding for Windows ARM64..." -ForegroundColor Green
cargo build --release --target aarch64-pc-windows-msvc

Write-Host "`nBuild complete!" -ForegroundColor Green
Read-Host "Press Enter to continue"
