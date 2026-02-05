#!/usr/bin/env bash
set -e

# Optional version argument: npm run release [version]
if [[ -n "$1" ]]; then
  TARGET_VERSION="$1"
  if [[ ! "$TARGET_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Invalid version format. Use semantic versioning (e.g., 1.2.3)"
    exit 1
  fi
fi

PACKAGE_NAME=$(node -p "require('./package.json').name")

# Push committed changes to origin
git push origin HEAD

# Get versions
LOCAL_VERSION=$(node -p "require('./package.json').version")
NPM_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "0.0.0")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
ORIGIN_VERSION=$(git show origin/$CURRENT_BRANCH:package.json 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version" || echo "$LOCAL_VERSION")

# Version comparison function
compare_versions() {
  local v1=$1 v2=$2
  IFS='.' read -r v1_major v1_minor v1_patch <<< "$v1"
  IFS='.' read -r v2_major v2_minor v2_patch <<< "$v2"

  if [[ $v1_major -gt $v2_major ]]; then echo 1; return; fi
  if [[ $v1_major -lt $v2_major ]]; then echo 2; return; fi
  if [[ $v1_minor -gt $v2_minor ]]; then echo 1; return; fi
  if [[ $v1_minor -lt $v2_minor ]]; then echo 2; return; fi
  if [[ $v1_patch -gt $v2_patch ]]; then echo 1; return; fi
  if [[ $v1_patch -lt $v2_patch ]]; then echo 2; return; fi
  echo 0
}

# Sync local version to origin if local is higher
ORIGIN_VERSION_CMP=$(compare_versions "$LOCAL_VERSION" "$ORIGIN_VERSION")
if [[ $ORIGIN_VERSION_CMP -eq 1 ]]; then
  # Update package-lock.json if exists
  if [[ -f "package-lock.json" ]]; then
    node -e "
      const fs = require('fs');
      const lockfile = require('./package-lock.json');
      lockfile.version = '$LOCAL_VERSION';
      if (lockfile.packages && lockfile.packages['']) {
        lockfile.packages[''].version = '$LOCAL_VERSION';
      }
      fs.writeFileSync('./package-lock.json', JSON.stringify(lockfile, null, 2) + '\n');
    "
    git add package-lock.json
  fi
  git add package.json
  git commit --amend --no-edit
  git push --force-with-lease origin HEAD
fi

# Handle explicit version argument
if [[ -n "$TARGET_VERSION" ]]; then
  TARGET_CMP=$(compare_versions "$TARGET_VERSION" "$NPM_VERSION")
  if [[ $TARGET_CMP -ne 1 ]]; then
    echo "Error: Target version ($TARGET_VERSION) must be higher than npm version ($NPM_VERSION)"
    exit 1
  fi

  node -e "
    const fs = require('fs');
    const pkg = require('./package.json');
    pkg.version = '$TARGET_VERSION';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  "

  if [[ -f "package-lock.json" ]]; then
    node -e "
      const fs = require('fs');
      const lockfile = require('./package-lock.json');
      lockfile.version = '$TARGET_VERSION';
      if (lockfile.packages && lockfile.packages['']) {
        lockfile.packages[''].version = '$TARGET_VERSION';
      }
      fs.writeFileSync('./package-lock.json', JSON.stringify(lockfile, null, 2) + '\n');
    "
  fi

  git add package.json package-lock.json 2>/dev/null || git add package.json
  git commit -m "chore: bump version to $TARGET_VERSION"
  git push origin HEAD
  LOCAL_VERSION="$TARGET_VERSION"
fi

# Semantic version bump based on commits
VERSION_CMP=$(compare_versions "$LOCAL_VERSION" "$NPM_VERSION")

if [[ $VERSION_CMP -eq 0 ]]; then
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
  COMMIT_RANGE="${PREV_TAG:+$PREV_TAG..}HEAD"

  HAS_BREAKING=false HAS_FEAT=false HAS_PATCH=false

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if [[ "$line" =~ ^[a-f0-9]+[[:space:]]+(feat|fix|perf|refactor|docs|build|ci|style|test)![:\(] ]]; then
      HAS_BREAKING=true
    fi
    if [[ "$line" =~ ^[a-f0-9]+[[:space:]]+feat[:\(] ]] && [[ ! "$line" =~ ^[a-f0-9]+[[:space:]]+feat![:\(] ]]; then
      HAS_FEAT=true
    fi
    if [[ "$line" =~ ^[a-f0-9]+[[:space:]]+(fix|perf|refactor|docs|build|ci|style|test)[:\(] ]] && [[ ! "$line" =~ ![:\(] ]]; then
      HAS_PATCH=true
    fi
  done < <(git log $COMMIT_RANGE --oneline)

  IFS='.' read -r MAJOR MINOR PATCH <<< "$LOCAL_VERSION"

  if [[ "$HAS_BREAKING" == true ]]; then
    NEW_VERSION="$((MAJOR + 1)).0.0"
  elif [[ "$HAS_FEAT" == true ]]; then
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
  else
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
  fi

  node -e "
    const fs = require('fs');
    const pkg = require('./package.json');
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  "

  if [[ -f "package-lock.json" ]]; then
    node -e "
      const fs = require('fs');
      const lockfile = require('./package-lock.json');
      lockfile.version = '$NEW_VERSION';
      if (lockfile.packages && lockfile.packages['']) {
        lockfile.packages[''].version = '$NEW_VERSION';
      }
      fs.writeFileSync('./package-lock.json', JSON.stringify(lockfile, null, 2) + '\n');
    "
  fi

  git add package.json package-lock.json 2>/dev/null || git add package.json
  git commit --amend --no-edit
  git push --force-with-lease
  LOCAL_VERSION="$NEW_VERSION"
elif [[ $VERSION_CMP -eq 2 ]]; then
  # Local < npm, bump from npm
  IFS='.' read -r MAJOR MINOR PATCH <<< "$NPM_VERSION"
  NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"

  node -e "
    const fs = require('fs');
    const pkg = require('./package.json');
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  "

  git add package.json
  git commit --amend --no-edit
  git push --force-with-lease
  LOCAL_VERSION="$NEW_VERSION"
fi

TAG="v$LOCAL_VERSION"

# Handle existing tag (failed release cleanup)
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG_VERSION="${TAG#v}"
  if [[ $(compare_versions "$TAG_VERSION" "$NPM_VERSION") -eq 1 ]]; then
    if command -v gh &> /dev/null && gh release view "$TAG" &> /dev/null; then
      gh release delete "$TAG" --yes
    fi
    git push origin --delete "$TAG" 2>/dev/null || true
    git tag -d "$TAG"
  else
    if command -v gh &> /dev/null && gh release view "$TAG" &> /dev/null; then
      echo "Error: Release $TAG already exists"
      exit 1
    fi
  fi
fi

# Create tag
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

# Generate AI-readable documentation (llms.txt)
echo "Generating llms.txt..."
node scripts/generate-llms-txt.mjs

# Stage generated files if changed
git add llms.txt llms-full.txt SKILL.md 2>/dev/null || true
if ! git diff --cached --quiet; then
  git commit --amend --no-edit
  git push --force-with-lease origin HEAD
  git tag -f "$TAG" -m "Release $TAG"
  git push --force origin "$TAG"
fi

# Generate changelog
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
COMMIT_RANGE="${PREV_TAG:+$PREV_TAG..}HEAD"

declare -a FEAT_COMMITS FIX_COMMITS REFACTOR_COMMITS DOCS_COMMITS OTHER_COMMITS

strip_prefix() {
  echo "$1" | sed -E 's/^(feat|fix|refactor|docs|chore|build|ci|style|test)(\([^)]*\))?[!]?:[[:space:]]*//'
}

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  msg="${line#* }"
  if [[ "$line" =~ ^[a-f0-9]+[[:space:]]+feat[:\(] ]]; then
    FEAT_COMMITS+=("$(strip_prefix "$msg")")
  elif [[ "$line" =~ ^[a-f0-9]+[[:space:]]+fix[:\(] ]]; then
    FIX_COMMITS+=("$(strip_prefix "$msg")")
  elif [[ "$line" =~ ^[a-f0-9]+[[:space:]]+refactor[:\(] ]]; then
    REFACTOR_COMMITS+=("$(strip_prefix "$msg")")
  elif [[ "$line" =~ ^[a-f0-9]+[[:space:]]+docs[:\(] ]]; then
    DOCS_COMMITS+=("$(strip_prefix "$msg")")
  else
    OTHER_COMMITS+=("$msg")
  fi
done < <(git log $COMMIT_RANGE --oneline)

CHANGELOG=""
[[ ${#FEAT_COMMITS[@]} -gt 0 ]] && { CHANGELOG+="## Features\n"; for c in "${FEAT_COMMITS[@]}"; do CHANGELOG+="- $c\n"; done; CHANGELOG+="\n"; }
[[ ${#FIX_COMMITS[@]} -gt 0 ]] && { CHANGELOG+="## Bug Fixes\n"; for c in "${FIX_COMMITS[@]}"; do CHANGELOG+="- $c\n"; done; CHANGELOG+="\n"; }
[[ ${#REFACTOR_COMMITS[@]} -gt 0 ]] && { CHANGELOG+="## Refactoring\n"; for c in "${REFACTOR_COMMITS[@]}"; do CHANGELOG+="- $c\n"; done; CHANGELOG+="\n"; }
[[ ${#DOCS_COMMITS[@]} -gt 0 ]] && { CHANGELOG+="## Documentation\n"; for c in "${DOCS_COMMITS[@]}"; do CHANGELOG+="- $c\n"; done; CHANGELOG+="\n"; }
[[ ${#OTHER_COMMITS[@]} -gt 0 ]] && { CHANGELOG+="## Other Changes\n"; for c in "${OTHER_COMMITS[@]}"; do CHANGELOG+="- $c\n"; done; CHANGELOG+="\n"; }
[[ -z "$CHANGELOG" ]] && CHANGELOG="No notable changes in this release."

# Extract repo from git remote
REMOTE_URL=$(git remote get-url origin)
if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
  REPO_OWNER="${BASH_REMATCH[1]}"
  REPO_NAME="${BASH_REMATCH[2]}"
else
  echo "Error: Could not parse GitHub repository from remote URL"
  exit 1
fi

# Create GitHub release
if command -v gh &> /dev/null; then
  echo -e "$CHANGELOG" | gh release create "$TAG" --title "$TAG" --notes-file -
else
  if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "Error: GITHUB_TOKEN required. Set it or install gh CLI."
    exit 1
  fi
  CHANGELOG_ESCAPED=$(echo -e "$CHANGELOG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases" \
    -d "{\"tag_name\": \"$TAG\", \"name\": \"$TAG\", \"body\": $CHANGELOG_ESCAPED}"
fi

echo "Release $TAG created! GitHub Action will publish to npm."
echo "Watch: https://github.com/$REPO_OWNER/$REPO_NAME/actions"
