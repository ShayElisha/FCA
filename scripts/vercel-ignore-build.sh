#!/bin/bash
# Vercel Ignore Build Script
# This script determines whether Vercel should build this commit
# Return 0 to build, 1 to skip

# Always build main branch
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "✅ Building main branch"
  exit 0
fi

# Get the list of changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)

# If no files changed, build
if [ -z "$CHANGED_FILES" ]; then
  echo "✅ No files changed, building"
  exit 0
fi

# Check if only documentation files changed
DOC_ONLY=true
while IFS= read -r file; do
  # Skip if it's a documentation file
  if [[ "$file" =~ ^docs/ ]] || \
     [[ "$file" =~ ^README ]] || \
     [[ "$file" =~ \.md$ ]] || \
     [[ "$file" =~ ^PHASE_.*\.md$ ]] || \
     [[ "$file" =~ ^IMPLEMENTATION_STATUS\.md$ ]] || \
     [[ "$file" =~ ^REFACTORING_PLAN\.md$ ]]; then
    continue
  fi
  
  # If we find a non-doc file, we need to build
  DOC_ONLY=false
  break
done <<< "$CHANGED_FILES"

if [ "$DOC_ONLY" = true ]; then
  echo "⏭️  Only documentation changed, skipping build"
  exit 1
fi

echo "✅ Code changed, building"
exit 0
