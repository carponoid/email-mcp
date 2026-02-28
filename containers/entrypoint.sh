#!/bin/sh
#
# entrypoint.sh — Email MCP Gateway container entrypoint
#
# Starts mcp-proxy as an SSE bridge in front of the email-mcp stdio server:
#
#   Agents (SSE :8000) ←→ mcp-proxy ←→ node dist/main.js stdio
#
# Config is host-mounted read-only at /etc/mcp-email/email-mcp/config.toml
# (XDG_CONFIG_HOME=/etc/mcp-email so email-mcp finds email-mcp/config.toml)
#
# Host volume layout (from pod.yaml):
#   /ai/mcp-email/config/   →  /etc/mcp-email/email-mcp/  (read-only)
#   /ai/mcp-email/logs/     →  /var/log/mcp-email/
#
# To configure accounts, create /ai/mcp-email/config/config.toml on the host.
# See mcp/email-mcp/config/config.toml.template for format.

set -e

CONFIG_TOML="/etc/mcp-email/email-mcp/config.toml"
PORT="${PORT:-8000}"

echo "════════════════════════════════════════"
echo " Email MCP Gateway starting"
echo " Transport: SSE on 0.0.0.0:$PORT"
echo "════════════════════════════════════════"

# Validate config exists
if [ ! -f "$CONFIG_TOML" ]; then
    echo "[entrypoint] ERROR: $CONFIG_TOML not found."
    echo "[entrypoint] Mount /ai/mcp-email/config/ at /etc/mcp-email/email-mcp (read-only)."
    echo "[entrypoint] Copy mcp/email-mcp/config/config.toml.template to /ai/mcp-email/config/config.toml"
    echo "[entrypoint] and fill in your account credentials before starting."
    exit 1
fi

echo "[entrypoint] Config found: $CONFIG_TOML"
echo "[entrypoint] XDG_CONFIG_HOME=$XDG_CONFIG_HOME"

# Start mcp-proxy: bridges SSE (agents) → stdio (email-mcp node process)
# --pass-environment : pass all env vars (incl. XDG_CONFIG_HOME) to the node subprocess
# --host / --port    : SSE server that agents connect to
# --                 : separator before the child command
# node dist/main.js stdio : the email-mcp server in stdio mode
#
# NODE_OPTIONS: prefer IPv4 and disable happy-eyeballs — host IPv6 routes to Google are unreachable
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first --no-network-family-autoselection"

exec uvx mcp-proxy \
    --pass-environment \
    --host "0.0.0.0" \
    --port "$PORT" \
    -- \
    node /app/dist/main.js stdio
