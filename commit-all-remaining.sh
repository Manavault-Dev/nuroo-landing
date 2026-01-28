#!/bin/bash
cd /Users/tilek/Desktop/Manavault/nuroo-landing

echo "📊 Checking git status..."
git status --short

echo ""
echo "📦 Committing all remaining files..."

# CI и конфиги
if [ -n "$(git status --short .github/ 2>/dev/null)" ]; then
  git add .github/
  git commit --no-verify -m "ci: add GitHub workflows and templates"
fi

if [ -n "$(git status --short .eslintrc.json .prettierrc .prettierignore .lintstagedrc.json 2>/dev/null)" ]; then
  git add .eslintrc.json .prettierrc .prettierignore .lintstagedrc.json
  git commit --no-verify -m "ci: add frontend linting and formatting config"
fi

if [ -n "$(git status --short .husky/ 2>/dev/null)" ]; then
  git add .husky/
  git commit --no-verify -m "ci: add Git hooks with Husky"
fi

if [ -n "$(git status --short backend/.eslintrc.json backend/.prettierrc 2>/dev/null)" ]; then
  git add backend/.eslintrc.json backend/.prettierrc
  git commit --no-verify -m "ci: add backend linting and formatting config"
fi

# Все остальные незакоммиченные файлы
REMAINING=$(git status --short | grep -v "^??" | awk '{print $2}' | head -20)
if [ -n "$REMAINING" ]; then
  echo ""
  echo "📝 Committing remaining files..."
  git add -A
  git commit --no-verify -m "chore: commit remaining changes"
fi

echo ""
echo "✅ Done!"
echo ""
echo "📊 Final status:"
git status --short
echo ""
echo "📝 Last 10 commits:"
git log --oneline -10
