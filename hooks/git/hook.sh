#!/bin/sh
# Git hook for every repo on the device: the install points the global core.hooksPath at a folder with one copy of this file
# per hook name. pre-commit refuses a commit whose staged changes hold a secret (gitleaks). Every name then runs the repo's
# own hook of that name, which a global hooksPath would otherwise skip. A repo that sets its own core.hooksPath (husky,
# lefthook) keeps only its own hooks, so the scan does not run there; `pre-commit install` (pre-commit.com) refuses while
# a global hooksPath is set.
name=$(basename "$0")
if [ "$name" = pre-commit ]; then
  # a Git client started from the macOS Dock may lack Homebrew's folders on PATH
  PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
  # winget adds gitleaks to the user PATH, which programs started before the install (VS Code) do not have yet
  if [ -n "$LOCALAPPDATA" ] && command -v cygpath >/dev/null 2>&1; then
    for d in "$(cygpath -u "$LOCALAPPDATA")"/Microsoft/WinGet/Packages/Gitleaks.Gitleaks_*; do PATH="$PATH:$d"; done
  fi
  if ! command -v gitleaks >/dev/null 2>&1; then
    echo "Commit refused: gitleaks is not installed, so the secret scan cannot run. Windows: winget install --id Gitleaks.Gitleaks -e; macOS: brew install gitleaks. Then open a new terminal and commit again." >&2
    exit 1
  fi
  if ! gitleaks git --pre-commit --redact --staged --verbose --no-banner; then
    echo "Commit refused: the staged changes hold a secret, or gitleaks failed (above). Remove it and rotate it if it was real; a false positive gets a gitleaks:allow comment on its line or its fingerprint in .gitleaksignore." >&2
    exit 1
  fi
fi
own="$(git rev-parse --git-common-dir)/hooks/$name"
if [ -x "$own" ]; then exec "$own" "$@"; fi
exit 0
