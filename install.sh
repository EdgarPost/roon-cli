#!/usr/bin/env bash
set -euo pipefail

# roon-cli installer
# Usage: curl -fsSL https://raw.githubusercontent.com/EdgarPost/roon-cli/main/install.sh | bash

REPO="EdgarPost/roon-cli"
INSTALL_DIR="${ROON_CLI_INSTALL_DIR:-$HOME/.local/share/roon-cli}"
BIN_DIR="${ROON_CLI_BIN_DIR:-$HOME/.local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1" >&2; exit 1; }

# Check dependencies
check_deps() {
    info "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed. Please install Node.js 18+ first."
    fi

    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js 18+ is required. Found: $(node -v)"
    fi

    if ! command -v npm &> /dev/null; then
        error "npm is required but not installed."
    fi

    if ! command -v git &> /dev/null; then
        error "git is required but not installed."
    fi
}

# Install roon-cli
install() {
    info "Installing roon-cli to $INSTALL_DIR..."

    # Create directories
    mkdir -p "$BIN_DIR"

    # Remove old installation if exists
    if [ -d "$INSTALL_DIR" ]; then
        warn "Removing existing installation..."
        rm -rf "$INSTALL_DIR"
    fi

    # Clone repository
    info "Cloning repository..."
    git clone --depth 1 "https://github.com/$REPO.git" "$INSTALL_DIR"

    # Install dependencies and build
    info "Installing dependencies..."
    cd "$INSTALL_DIR"
    npm install --production=false

    info "Building..."
    npm run build

    # Make executables
    chmod +x dist/cli.cjs dist/daemon.cjs

    # Create symlinks
    info "Creating symlinks in $BIN_DIR..."
    ln -sf "$INSTALL_DIR/dist/cli.cjs" "$BIN_DIR/roon"
    ln -sf "$INSTALL_DIR/dist/daemon.cjs" "$BIN_DIR/roon-daemon"

    # Check if BIN_DIR is in PATH
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        warn "$BIN_DIR is not in your PATH"
        warn "Add this to your shell profile:"
        echo ""
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
    fi
}

# Install systemd service
install_systemd() {
    if [ -d "$HOME/.config/systemd/user" ] || command -v systemctl &> /dev/null; then
        info "Installing systemd user service..."
        mkdir -p "$HOME/.config/systemd/user"
        cp "$INSTALL_DIR/systemd/roon-daemon.service" "$HOME/.config/systemd/user/"

        # Update ExecStart path
        sed -i "s|%h/.local/bin/roon-daemon|$BIN_DIR/roon-daemon|g" \
            "$HOME/.config/systemd/user/roon-daemon.service"

        systemctl --user daemon-reload

        echo ""
        info "Systemd service installed. To enable:"
        echo "    systemctl --user enable --now roon-daemon"
    fi
}

# Main
main() {
    echo ""
    echo "  roon-cli installer"
    echo "  ==================="
    echo ""

    check_deps
    install
    install_systemd

    echo ""
    info "Installation complete!"
    echo ""
    echo "  Quick start:"
    echo "    1. Start daemon:    roon-daemon (or enable systemd service)"
    echo "    2. Authorize:       Roon -> Settings -> Extensions -> Enable 'Roon CLI'"
    echo "    3. Set zone:        roon zones && roon zone set 'Zone Name'"
    echo "    4. Control:         roon play | roon pause | roon status"
    echo ""
}

main "$@"
