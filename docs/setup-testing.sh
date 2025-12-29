#!/bin/bash
# Automated Testing Setup Script for Basset Hound Extension

set -e  # Exit on error

echo "=========================================="
echo "Basset Hound Extension - Testing Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current Node version
echo "Checking Node.js version..."
CURRENT_NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
echo "Current Node.js version: $CURRENT_NODE_VERSION"

# Required minimum version
REQUIRED_VERSION="v14.15.0"
echo "Required Node.js version: >= $REQUIRED_VERSION"
echo ""

# Compare versions
version_compare() {
    if [[ $1 == "not found" ]]; then
        return 1
    fi

    # Remove 'v' prefix and compare
    current=$(echo $1 | sed 's/v//')
    required=$(echo $2 | sed 's/v//')

    if [ "$(printf '%s\n' "$required" "$current" | sort -V | head -n1)" = "$required" ]; then
        return 0
    else
        return 1
    fi
}

# Check if upgrade needed
UPGRADE_NEEDED=false
if ! version_compare "$CURRENT_NODE_VERSION" "$REQUIRED_VERSION"; then
    UPGRADE_NEEDED=true
    echo -e "${RED}⚠ Node.js upgrade required!${NC}"
    echo ""
    echo "Your current version ($CURRENT_NODE_VERSION) is too old."
    echo "Tests require Node.js v14.15.0 or higher."
    echo ""
    echo "Recommended: Node.js v18 LTS"
    echo ""

    # Check if nvm is installed
    if command -v nvm &> /dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${GREEN}✓ NVM detected${NC}"
        echo ""
        echo "To upgrade using NVM, run:"
        echo "  nvm install 18"
        echo "  nvm use 18"
        echo "  nvm alias default 18"
        echo ""
        echo "Then run this script again."

        read -p "Would you like to install Node.js 18 now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Source nvm
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

            echo "Installing Node.js 18..."
            nvm install 18
            nvm use 18
            nvm alias default 18

            echo -e "${GREEN}✓ Node.js upgraded successfully!${NC}"
            CURRENT_NODE_VERSION=$(node -v)
            echo "New version: $CURRENT_NODE_VERSION"
            UPGRADE_NEEDED=false
        else
            echo "Please upgrade Node.js manually and run this script again."
            exit 1
        fi
    else
        echo -e "${YELLOW}NVM not found. Install it first:${NC}"
        echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
        echo ""
        echo "Or install Node.js via package manager:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        echo ""
        exit 1
    fi
else
    echo -e "${GREEN}✓ Node.js version is compatible${NC}"
fi

echo ""
echo "=========================================="
echo "Installing Dependencies"
echo "=========================================="
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "node_modules directory exists"
    read -p "Reinstall dependencies? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleaning node_modules..."
        rm -rf node_modules package-lock.json
        echo "Installing fresh dependencies..."
        npm install
    else
        echo "Skipping dependency installation"
    fi
else
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo "=========================================="
echo "Running Automated Tests"
echo "=========================================="
echo ""

# Ask which tests to run
echo "Select test suite to run:"
echo "  1) All tests (unit + integration)"
echo "  2) Unit tests only (fast)"
echo "  3) Integration tests only"
echo "  4) Skip tests for now"
echo ""
read -p "Enter choice (1-4): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "Running all tests..."
        npm test
        ;;
    2)
        echo "Running unit tests..."
        npm run test:unit
        ;;
    3)
        echo "Running integration tests..."
        npm run test:integration
        ;;
    4)
        echo "Skipping tests"
        ;;
    *)
        echo "Invalid choice, skipping tests"
        ;;
esac

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Load the extension in Chrome:"
echo "   - Open chrome://extensions/"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $PWD"
echo ""
echo "2. Start the test server:"
echo "   npm run test:server"
echo ""
echo "3. In another terminal, serve manual test pages:"
echo "   npm run test:manual"
echo ""
echo "4. Open http://localhost:8080/ in Chrome to test"
echo ""
echo "For more details, see LOCAL_TESTING_GUIDE.md"
echo ""
