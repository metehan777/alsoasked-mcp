# AlsoAsked MCP Server

A Model Context Protocol (MCP) server for the AlsoAsked API, providing access to Google's "People Also Ask" data for SEO research and content optimization.

## Features

- **Search People Also Ask Questions**: Get hierarchical PAA data for any search terms
- **Account Management**: Check your API credits and account status  
- **Flexible Search Options**: Configure language, region, depth, and freshness
- **Rich Data Structure**: Formatted results with question hierarchy and counts

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Get AlsoAsked API Key

1. Sign up for an [AlsoAsked Pro account](https://alsoasked.com/pricing)
2. Generate an API key from your dashboard
3. Keep your API key secure

### 4. Add to Claude Configuration

Add this to your Claude `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "alsoasked": {
      "command": "node",
      "args": ["/path/to/your/alsoasked-mcp/dist/index.js"],
      "env": {
        "ALSOASKED_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 5. Restart Claude Desktop

Restart Claude Desktop to load the new MCP server.

## Usage

The server provides three main tools:

### search_people_also_ask
Search for PAA questions with full control over parameters:

```typescript
// Example: Search for marketing questions in Spanish for Mexico
{
  "terms": ["digital marketing", "content strategy"],
  "language": "es",
  "region": "mx", 
  "depth": 3,
  "fresh": true
}
```

### search_single_term
Convenient method for single-term searches:

```typescript
// Example: Quick search for a single term
{
  "term": "machine learning",
  "depth": 2
}
```

### get_account_info
Check your account status and remaining credits:

```typescript
// No parameters needed
{}
```

## API Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `terms` | string[] | required | Search terms to query |
| `language` | string | "en" | Language code (en, es, fr, etc.) |
| `region` | string | "us" | Region code (us, uk, ca, etc.) |
| `depth` | number | 2 | Question hierarchy depth (1-3) |
| `fresh` | boolean | false | Fetch fresh vs cached results |
| `async` | boolean | false | Process asynchronously |

## Response Format

The server returns structured data with:

- **Question Hierarchy**: Nested questions with levels
- **Search Metadata**: Total questions, search terms
- **Account Info**: Credits remaining, plan details
- **Formatted Output**: Clean JSON structure for easy parsing

## Example Queries

Ask Claude:

> "Use AlsoAsked to find People Also Ask questions for 'sustainable energy' with depth 3"

> "Get PAA data for SEO keyword research on 'home workout equipment' in the UK market"

> "Check my AlsoAsked account credits and usage"

## Development

```bash
# Watch mode for development
npm run dev

# Build for production  
npm run build

# Start the server
npm start
```

## Cost Considerations

- **Pro Plan**: $59/month with 1,000 queries included
- **Additional Credits**: $0.03-$0.06 per query
- **API Efficiency**: Use appropriate depth levels to control costs

## Support

- [AlsoAsked Documentation](https://developers.alsoasked.com/)
- [MCP Protocol Docs](https://modelcontextprotocol.io/)
- [API Specification](https://github.com/AlsoAsked/also-asked-api-specification)

## License

MIT License - feel free to modify and distribute as needed.