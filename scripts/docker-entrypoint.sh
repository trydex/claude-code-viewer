#!/usr/bin/env bash
set -euo pipefail

CLAUDE_HOME="${HOME}/.claude"

# Make sure `~/.claude/projects` folder exists.
mkdir -p "$CLAUDE_HOME/projects"

# Only bootstrap when Claude home is backed by an external volume.
if ! mountpoint -q "$CLAUDE_HOME" && [ ! -f "$CLAUDE_HOME/settings.json" ]; then
  cat <<EOF > "$CLAUDE_HOME/settings.json"
{
  "env": {
    "ANTHROPIC_BASE_URL": "${ANTHROPIC_BASE_URL:-}",
    "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY:-}",
    "ANTHROPIC_AUTH_TOKEN": "${ANTHROPIC_AUTH_TOKEN:-}"
  }
}
EOF
fi

mkdir -p "/E:" "/C:/Users"
ln -sf /root/workspace "/E:/Repos"
ln -sf /root "/C:/Users/trydex"
git config --global --add safe.directory '*'

if [ -n "${CCV_PATH_MAPPINGS:-}" ]; then
  node -e "
const fs = require('fs');
const path = require('path');
const mappings = JSON.parse(process.env.CCV_PATH_MAPPINGS || '{}');
const projectsDir = path.join(process.env.HOME, '.claude', 'projects');
const toSlug = (p) => p.replace(/[^a-zA-Z0-9]/g, '-');
try {
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
  for (const [winPrefix, linuxPrefix] of Object.entries(mappings)) {
    const winSlug = toSlug(winPrefix);
    const linuxSlug = toSlug(linuxPrefix);
    for (const d of dirs) {
      if (d.name.startsWith(winSlug) && !d.isSymbolicLink()) {
        const linuxName = d.name.replace(winSlug, linuxSlug);
        const linkPath = path.join(projectsDir, linuxName);
        const targetPath = path.join(projectsDir, d.name);
        try {
          const linkStat = fs.lstatSync(linkPath);
          if (linkStat.isSymbolicLink()) {
            continue;
          }
          if (linkStat.isDirectory()) {
            const files = fs.readdirSync(linkPath);
            for (const f of files) {
              const src = path.join(linkPath, f);
              const dst = path.join(targetPath, f);
              if (!fs.existsSync(dst)) {
                fs.renameSync(src, dst);
                console.log('Moved session file:', f, 'from', linuxName, 'to', d.name);
              }
            }
            fs.rmSync(linkPath, { recursive: true });
            console.log('Removed real dir:', linuxName);
          }
        } catch (e) {
          if (e.code !== 'ENOENT') { throw e; }
        }
        fs.symlinkSync(targetPath, linkPath);
        console.log('Project symlink:', linuxName, '->', d.name);
      }
    }
  }
} catch (e) { console.error('Path mapping symlinks error:', e.message); }
"
fi

exec "$@"
