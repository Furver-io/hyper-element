#!/usr/bin/env bash
#
# Check for forbidden c8 ignore comments
# These coverage exclusions are not allowed in source files

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  No c8 ignore"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "  Checking for forbidden c8 ignore comments..."
echo ""

# Search src/ for c8 ignore directives (excluding the explanatory note in build.js)
# Pattern matches: /* c8 ignore start */, /* c8 ignore stop */, /* c8 ignore next */
MATCHES=$(grep -rn "\/\* c8 ignore \(start\|stop\|next\)" src/ 2>/dev/null || true)

if [ -n "$MATCHES" ]; then
    echo "  ✗ Found forbidden c8 ignore comments:"
    echo ""
    echo "$MATCHES" | while read -r line; do
        echo "    $line"
    done
    echo ""
    echo "  Coverage exclusions are not allowed. Fix the code or tests instead."
    exit 1
fi

echo "  ✓ No c8 ignore comments found"
exit 0
