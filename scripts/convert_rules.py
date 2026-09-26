#!/usr/bin/env python3
"""
Convert Loon Rule-Set (.lsr) to standard Clash / Mihomo classical rule provider (.list)
"""

import sys
import re

def convert_lsr_to_list(lsr_content: str) -> str:
    output_lines = []
    
    for line in lsr_content.splitlines():
        trimmed = line.strip()
        
        # Preserve comments and empty lines
        if not trimmed or trimmed.startswith("#") or trimmed.startswith(";"):
            output_lines.append(trimmed)
            continue
            
        # Handle Loon logical AND rules: AND, ((DOMAIN-KEYWORD, xxx), (DOMAIN-SUFFIX, yyy))
        # Mihomo / Clash Classical rule provider does not support composite AND expressions in .list.
        # We degrade it to DOMAIN-SUFFIX for maximum compatibility, or preserve if already supported.
        and_match = re.match(r"^AND,\s*\(\(.*?(DOMAIN-SUFFIX|DOMAIN|DOMAIN-KEYWORD),\s*([^\)]+)\)\)", trimmed, re.IGNORECASE)
        if and_match:
            # Keep comments for trace
            rule_type = and_match.group(1).upper()
            rule_val = and_match.group(2).strip()
            output_lines.append(f"{rule_type},{rule_val}")
            continue

        # Normal rule line: DOMAIN, xxx or DOMAIN-SUFFIX, xxx, POLICY
        # Classical rule provider in Clash/Mihomo expects: TYPE,VALUE (no policy at the end)
        parts = [p.strip() for p in trimmed.split(",")]
        if len(parts) >= 2:
            rule_type = parts[0].upper()
            rule_val = parts[1]
            if rule_type in [
                "DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD", 
                "IP-CIDR", "IP-CIDR6", "GEOIP", "PROCESS-NAME"
            ]:
                # Standard Mihomo rule line: TYPE,VALUE
                output_lines.append(f"{rule_type},{rule_val}")
            else:
                output_lines.append(f"# [SKIPPED_UNSUPPORTED] {trimmed}")
        else:
            output_lines.append(trimmed)
            
    return "\n".join(output_lines) + "\n"

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: convert_rules.py <input.lsr> <output.list>")
        sys.exit(1)
        
    src_path = sys.argv[1]
    dst_path = sys.argv[2]
    
    with open(src_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    converted = convert_lsr_to_list(content)
    
    with open(dst_path, "w", encoding="utf-8") as f:
        f.write(converted)
        
    print(f"Successfully converted {src_path} -> {dst_path}")
