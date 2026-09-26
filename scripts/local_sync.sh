#!/usr/bin/env bash
set -e

REPO_DIR="/root/data/pub_github/ApexApple_AE1"
cd "$REPO_DIR"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Starting rule sync ==="

mkdir -p rule/loon rule

# 1. Fetch AI.lsr from upstream with client UA
echo "Fetching AI.lsr..."
curl -s -f -A "Clash.meta" "https://kelee.one/Tool/Loon/Lsr/AI.lsr" -o rule/loon/AI.lsr.tmp || {
    echo "Failed to fetch AI.lsr"
    rm -f rule/loon/AI.lsr.tmp
}

if [ -s rule/loon/AI.lsr.tmp ]; then
    # Inject Meta additions directly under '# Meta' block if missing
    python3 -c '
import re

with open("rule/loon/AI.lsr.tmp", "r", encoding="utf-8") as f:
    content = f.read()

# Check if muse.ai is already present
if "muse.ai" not in content:
    target = "# Meta\nDOMAIN, imagine.meta.com\nDOMAIN-SUFFIX, meta.ai"
    replacement = "# Meta\nDOMAIN, imagine.meta.com\nDOMAIN-SUFFIX, meta.ai\nDOMAIN, auth.muse.ai\nDOMAIN-SUFFIX, muse.ai"
    if target in content:
        content = content.replace(target, replacement)
    else:
        # Fallback if Meta block changed
        content += "\n\n# Meta (Custom)\nDOMAIN, auth.muse.ai\nDOMAIN-SUFFIX, muse.ai\n"

    with open("rule/loon/AI.lsr.tmp", "w", encoding="utf-8") as f:
        f.write(content)
'
    mv rule/loon/AI.lsr.tmp rule/loon/AI.lsr

    # Convert to Mihomo / Clash Classical format (.list)
    python3 scripts/convert_rules.py rule/loon/AI.lsr rule/AI.list
fi

# 2. Fetch TikTok.yaml
echo "Fetching TikTok.yaml..."
curl -s -f -A "Clash.meta" "https://kelee.one/Tool/Clash/Rule/TikTok.yaml" -o rule/TikTok.yaml.tmp || {
    echo "Failed to fetch TikTok.yaml"
    rm -f rule/TikTok.yaml.tmp
}

if [ -s rule/TikTok.yaml.tmp ]; then
    mv rule/TikTok.yaml.tmp rule/TikTok.yaml
fi

# 3. Check for git diff and push if changed
git add rule/loon/AI.lsr rule/AI.list rule/TikTok.yaml

if git diff --staged --quiet; then
    echo "No rule changes detected. All rules up-to-date."
else
    echo "Changes detected! Committing and pushing to remote..."
    git commit -m "chore(rules): sync upstream rules [automated]"
    git push origin main
    echo "Pushed successfully."
fi

echo "=== Sync finished ==="
