#!/bin/bash
cd /Users/tilek/Desktop/Manavault/nuroo-landing

echo "📊 Current git status:"
git status --short
echo ""

# CI файлы
if git status --short .github/ 2>/dev/null | grep -q .; then
  echo "📦 Committing GitHub workflows..."
  git add .github/
  git commit --no-verify -m "ci: add GitHub workflows and templates"
fi

# Frontend linting config
if git status --short .eslintrc.json .prettierrc .prettierignore .lintstagedrc.json 2>/dev/null | grep -q .; then
  echo "📦 Committing frontend linting config..."
  git add .eslintrc.json .prettierrc .prettierignore .lintstagedrc.json
  git commit --no-verify -m "ci: add frontend linting and formatting config"
fi

# Husky hooks
if git status --short .husky/ 2>/dev/null | grep -q .; then
  echo "📦 Committing Husky hooks..."
  git add .husky/
  git commit --no-verify -m "ci: add Git hooks with Husky"
fi

# Backend linting config
if git status --short backend/.eslintrc.json backend/.prettierrc 2>/dev/null | grep -q .; then
  echo "📦 Committing backend linting config..."
  git add backend/.eslintrc.json backend/.prettierrc
  git commit --no-verify -m "ci: add backend linting and formatting config"
fi

# Все остальное
REMAINING=$(git status --short | grep -v "^??")
if [ -n "$REMAINING" ]; then
  echo "📦 Committing remaining files..."
  git add -A
  git commit --no-verify -m "chore: commit remaining changes"
fi

echo ""
echo "✅ All done!"
echo ""
echo "📊 Final status:"
git status --short
echo ""
echo "📝 Last 10 commits:"
git log --oneline -10
