#!/bin/bash

echo "================================="
echo "Style Preservation Test Runner"
echo "================================="
echo ""

# Try Node.js first
if command -v node &> /dev/null; then
    echo "✓ Node.js found, running test..."
    echo ""
    node test-style-preservation.mjs
    exit $?
fi

# Try Python as fallback
if command -v python3 &> /dev/null; then
    echo "✓ Python 3 found, running test..."
    echo ""
    python3 test_style_preservation.py
    exit $?
fi

if command -v python &> /dev/null; then
    echo "✓ Python found, running test..."
    echo ""
    python test_style_preservation.py
    exit $?
fi

echo "❌ ERROR: Neither Node.js nor Python found"
echo ""
echo "Please install one of:"
echo "  - Node.js 14+ (recommended)"
echo "  - Python 3.6+"
echo ""
echo "Then run either:"
echo "  node test-style-preservation.mjs"
echo "  python3 test_style_preservation.py"
exit 1
