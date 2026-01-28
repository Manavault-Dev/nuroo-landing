#!/bin/bash
cd /Users/tilek/Desktop/Manavault/nuroo-landing

echo "Checking status..."
git status --short

echo ""
echo "Adding all files..."
git add -A

echo ""
echo "Committing..."
git commit --no-verify -m "chore: commit all remaining changes"

echo ""
echo "Final status:"
git status --short

echo ""
echo "Last 5 commits:"
git log --oneline -5
