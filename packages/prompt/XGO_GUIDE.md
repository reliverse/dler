# xgo Setup Guide

## What is xgo?

**xgo** is a Go cross-compilation tool that uses Docker to build Go applications for multiple platforms and architectures. It's particularly useful for projects that use **CGO** (C bindings), which are notoriously difficult to cross-compile manually.

The project uses `github.com/crazy-max/xgo`, which is a fork version of the original xgo project.

## Why Use xgo?

1. **CGO Support**: The project uses CGO (`import "C"` in `main.go`), which makes cross-compilation complex. xgo handles this automatically.
2. **Multiple Targets**: Build for Windows, Linux, macOS (both Intel and ARM) in one command.
3. **Docker Isolation**: Each build runs in a clean Docker container, ensuring consistent builds.
4. **No Manual Setup**: No need to install cross-compilers for each target platform.

## Prerequisites

### 1. Install Docker

xgo **requires Docker** to work. Docker provides the isolated environments needed for cross-compilation.

#### Windows

1. Download **Docker Desktop** from: <https://www.docker.com/products/docker-desktop/>
2. Install and launch Docker Desktop
3. Ensure Docker is running (you'll see the Docker icon in the system tray)
4. Verify installation:

   ```powershell
   docker --version
   docker ps
   ```

#### macOS

1. Download **Docker Desktop** from: <https://www.docker.com/products/docker-desktop/>
2. Install and launch Docker Desktop
3. Verify installation:

   ```bash
   docker --version
   docker ps
   ```

#### Linux

```bash
# Install Docker (Ubuntu/Debian example)
sudo apt-get update
sudo apt-get install docker.io

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add the user to docker group (to run without sudo)
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect

# Verify
docker --version
docker ps
```

### 2. Install Go

You need Go installed to build and install xgo.

1. Download from: <https://golang.org/dl/>
2. Install following the instructions for the OS
3. Verify installation:

   ```bash
   go version
   ```

### 3. Install xgo

Once Go and Docker are installed, install xgo:

```bash
go install github.com/crazy-max/xgo@latest
```

This installs xgo to `$HOME/go/bin/xgo` (or `%USERPROFILE%\go\bin\xgo.exe` on Windows).

**Important**: Make sure `$HOME/go/bin` (or `%USERPROFILE%\go\bin` on Windows) is in the PATH.

#### Verify xgo Installation

```bash
# Check if xgo is accessible
xgo --version

# Or check the path directly
# Windows:
%USERPROFILE%\go\bin\xgo.exe --version

# Linux/macOS:
$HOME/go/bin/xgo --version
```

## How xgo Works

1. **Docker Images**: xgo uses pre-built Docker images containing cross-compilation toolchains
2. **Container Builds**: For each target platform, xgo:
   - Spins up a Docker container with the appropriate toolchain
   - Copies the Go code into the container
   - Compiles the code with CGO support
   - Outputs the binary to the `release/` directory

## Using xgo in The Project

Just run the build script:

```bash
# Use xgo (default)
bun run build

# Or explicitly
bun run build --provider xgo
```

The build script will:

1. Build the TypeScript code
2. Use xgo to cross-compile Go binaries for:
   - `linux/arm64`
   - `linux/amd64`
   - `darwin/arm64` (Apple Silicon)
   - `darwin/amd64` (Intel Mac)
   - `windows/amd64`

## Manual xgo Usage

You can also use xgo directly from the command line:

```bash
# Build for specific targets
xgo --targets=windows/amd64,linux/amd64 .

# Build with specific Go version
xgo -go 1.20.3 --targets=windows/amd64 .

# Build with output directory
xgo -out release/dler-prompt --targets=windows/amd64 .

# Build with CGO (c-shared mode)
xgo -buildmode=c-shared -out release/dler-prompt --targets=windows/amd64 .
```

## Troubleshooting

### "docker: executable file not found"

- **Solution**: Docker is not installed or not in PATH
- Install Docker Desktop and ensure it's running

### "xgo not found"

- **Solution**: xgo is not installed or not in PATH
- Install: `go install github.com/crazy-max/xgo@latest`
- Add `$HOME/go/bin` to the PATH

### "Failed to check docker installation"

- **Solution**: Docker daemon is not running
- Start Docker Desktop (Windows/macOS) or Docker service (Linux)

### Build fails for specific platform

- Some platforms may fail if Docker images aren't available
- Check xgo logs for specific error messages
- Ensure Docker has enough resources allocated

### First build is slow

- xgo downloads Docker images on first use
- Subsequent builds are faster as images are cached

## xgo vs Regular Go Build

| Feature | xgo | Regular Go Build |
|---------|-----|------------------|
| CGO Support | ✅ Full support | ⚠️ Limited cross-compilation |
| Multiple Platforms | ✅ Easy | ⚠️ Requires manual setup |
| Docker Required | ✅ Yes | ❌ No |
| Setup Complexity | ✅ Simple | ⚠️ Complex (C cross-compilers) |
| Build Speed | ⚠️ Slower (Docker overhead) | ✅ Faster |
| Reliability | ✅ Very reliable | ⚠️ Platform-dependent |

## Summary

**To use xgo in the project:**

1. ✅ Install Docker Desktop
2. ✅ Install Go
3. ✅ Install xgo: `go install github.com/crazy-max/xgo@latest`
4. ✅ Ensure Docker is running
5. ✅ Run: `bun run build --provider xgo`

That's it! xgo handles all the cross-compilation complexity for you.
