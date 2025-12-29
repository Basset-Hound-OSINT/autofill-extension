#!/bin/bash
# Quick Test Runner - Run this after Node.js upgrade

echo "=========================================="
echo "Basset Hound - Quick Test"
echo "=========================================="
echo ""

# Check Node version
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"
echo ""

# Extract major version
MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')

if [ "$MAJOR_VERSION" -lt 14 ]; then
    echo "❌ ERROR: Node.js version is too old"
    echo "Current: $NODE_VERSION"
    echo "Required: v14.15.0 or higher"
    echo ""
    echo "Please upgrade Node.js first:"
    echo "  ./setup-testing.sh"
    exit 1
fi

echo "✓ Node.js version is compatible"
echo ""

# Check if dependencies installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "=========================================="
echo "Running Quick Test Suite"
echo "=========================================="
echo ""

# Run unit tests with summary
echo "Running unit tests..."
npm run test:unit -- --verbose=false --silent=false 2>&1 | tail -20

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""

# Run all tests with brief output
npm test -- --verbose=false 2>&1 | grep -E "(PASS|FAIL|Test Suites|Tests:|Snapshots:|Time:)"

echo ""
echo "For detailed coverage report, run:"
echo "  npm run test:coverage"
echo ""
echo "To view coverage in browser:"
echo "  npm run test:coverage && xdg-open coverage/lcov-report/index.html"
echo ""
