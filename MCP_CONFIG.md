# MCP Server Configuration

This file documents the MCP (Model Context Protocol) server configuration for Render.com integration.

## Configuration

Add the following to your Cursor MCP server settings:

### Location
Cursor MCP server configurations are typically stored in:
- **Windows**: `%APPDATA%\Cursor\User\settings.json` or Cursor's MCP settings
- **macOS/Linux**: `~/.config/Cursor/User/settings.json` or Cursor's MCP settings

### Configuration JSON

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer rnd_TPZWcHYIZgcnlVuJoQQOiFYVYkTF"
      }
    }
  }
}
```

## How to Add

1. Open Cursor Settings
2. Search for "MCP" or "Model Context Protocol"
3. Add the configuration above to your MCP servers settings
4. Restart Cursor if needed

## Security Note

⚠️ **Important**: The bearer token in this configuration provides access to your Render.com account. Keep it secure and do not commit it to public repositories.

If you need to regenerate the token:
1. Go to Render.com dashboard
2. Navigate to Account Settings → API Tokens
3. Generate a new token and update the configuration

