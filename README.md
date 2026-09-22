# kaspa-script-mcp

An MCP server with tooling for Kaspa's Toccata-era script/covenant layer. Pure
TypeScript, no node or SDK dependency at runtime — the opcode table and pricing
constants are generated from `rusty-kaspa` v2.1.0 (commit `01b532e`).

## Tools
- **disassemble_script** — hex → opcodes + data pushes, the way the engine's parser walks it; flags disabled/reserved opcodes and truncated pushes.
- **estimate_script_cost** — approximate script units, compute-mass grams, share of the 500,000-gram block compute limit, and the minimum per-input compute budget to commit. Size a budget before signing to avoid `ExceededCommittedScriptUnits`.
- **explain_script_error** — plain-language explanation + fix for txscript errors (metering, stack, opcode, push-encoding, ZK integrity).
- **lookup_opcode** — by hex code or name.

## Build & run
```
npm install && npm run build
node dist/selftest.js   # 17 checks
node dist/index.js      # stdio MCP server
```

## Client config (Claude Code / desktop)
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
