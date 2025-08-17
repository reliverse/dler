@echo off
echo Setting up Visual Studio Build Tools environment...

REM Try to find and set up Visual Studio Build Tools
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    echo Found VS 2022 Build Tools
    call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    echo Found VS 2019 Build Tools
    call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else if exist "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    echo Found VS 2017 Build Tools
    call "C:\Program Files (x86)\Microsoft Visual Studio\2017\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) else (
    echo Visual Studio Build Tools not found in standard locations
    echo Please ensure you have the C++ build tools workload installed
    pause
    exit /b 1
)

echo Environment set up complete
echo Current PATH includes: %PATH%
echo.

echo Building for current platform...
cargo build --release

echo.
echo Building for Windows ARM64...
cargo build --release --target aarch64-pc-windows-msvc

echo.
echo Build complete!
pause
