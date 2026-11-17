# kaspa-script-mcp

[![Kaspa Script Tools MCP server](https://mcprush.com/badge/kaspa-script-tools-mcp/compact.svg)](https://mcprush.com/to/kaspa-script-tools-mcp?ref=badge)

An MCP server with tooling for Kaspa's Toccata-era script/covenant layer. Pure
TypeScript, no node or SDK dependency at runtime — the opcode table and pricing
constants are generated from `rusty-kaspa` v2.1.0 (commit `01b532e`).

## Tools
- **disassemble_script** — hex → opcodes + data pushes, the way the engine's parser walks it; flags disabled/reserved opcodes and truncated pushes.
- **estimate_script_cost** — approximate script units, compute-mass grams, share of the 500,000-gram block compute limit, and the minimum per-input compute budget to commit. Size a budget before signing to avoid `ExceededCommittedScriptUnits`.
- **explain_script_error** — plain-language explanation + fix for txscript errors (metering, stack, opcode, push-encoding, ZK integrity).
- **lookup_opcode** — by hex code or name.

## Install

No build needed. Add it to your MCP client (Claude Code, Claude Desktop, Cursor, VS Code):

```json
{ "mcpServers": { "kaspa-script": { "command": "npx", "args": ["-y", "kaspa-script-mcp"] } } }
```

In Claude Code: `claude mcp add kaspa-script -- npx -y kaspa-script-mcp`

## Build from source
```
npm install && npm run build
node dist/selftest.js   # 17 checks
node dist/index.js      # stdio MCP server
```

To run a local build instead, point the client at it:
```json
{ "mcpServers": { "kaspa-script": { "command": "node", "args": ["<path>/kaspa-script-mcp/dist/index.js"] } } }
```

## Scope & honesty
`estimate_script_cost` is an estimate of the dominant charges (per-byte, pushed
bytes, hash opcodes, fixed ZK costs), not the consensus value; ZK per-public-input
VK pricing isn't fully derivable statically and is flagged in the output. The
opcode table and constants are pinned to a specific rusty-kaspa commit; regenerate
on consensus changes.

## License
MIT
