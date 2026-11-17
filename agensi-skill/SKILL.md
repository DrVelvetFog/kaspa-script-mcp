---
name: kaspa-script-debugger
description: Debug and size Kaspa (Toccata-era, rusty-kaspa v2.1.0) scripts and covenants. Use when the user pastes Kaspa script hex, asks what a script does, hits a txscript error (ExceededCommittedScriptUnits, "stack contains N unexpected items", ZK Integrity, disabled opcode, push-encoding), needs to pick a per-input compute budget before signing, or asks about a Kaspa opcode. Requires the open-source kaspa-script-mcp server.
---

# Kaspa script debugger

This skill tells you when and how to use the `kaspa-script-mcp` MCP server's four
tools for Kaspa script work. The tools are deterministic and offline: the opcode
table and pricing constants are generated from rusty-kaspa v2.1.0 (commit `01b532e`).

## Setup (one time)

The tools come from the MCP server, not from this skill. If the tools
`disassemble_script`, `estimate_script_cost`, `explain_script_error` and
`lookup_opcode` are not available, tell the user to add the server (published on npm
as `kaspa-script-mcp`) to the agent's MCP config:

```json
{ "mcpServers": { "kaspa-script": { "command": "npx", "args": ["-y", "kaspa-script-mcp"] } } }
```

In Claude Code: `claude mcp add kaspa-script -- npx -y kaspa-script-mcp`.

Don't guess at opcode meanings or costs from memory while the server is missing.
Say it's missing and give the setup steps.

## Which tool, when

| The user has… | Call | Input |
|---|---|---|
| Script hex and wants to know what it does | `disassemble_script` | `script_hex` (0x-prefixed or bare) |
| Script hex and is about to sign, or got `ExceededCommittedScriptUnits` | `estimate_script_cost` | `script_hex` |
| An error string from a node or SDK | `explain_script_error` | `error_text`, the exact string, unedited |
| An opcode name or byte | `lookup_opcode` | `query`, e.g. `0xa8` or `OpSHA256` |

## Workflows

**"Why did my transaction fail?"**
1. `explain_script_error` with the exact error text.
2. If the user also has the script hex, `disassemble_script` it and point at the
   opcode or push the error refers to.
3. For metering errors, run `estimate_script_cost` and compare against the budget
   they committed.

**"How much compute budget should I commit?"**
1. `estimate_script_cost` on the script.
2. Report the minimum per-input budget it returns and the share of the
   500,000-gram block compute limit.
3. Recommend a margin above the minimum and say why: the figure is an estimate (see
   Limits).

**"What does this script do?"**
1. `disassemble_script`.
2. Walk the opcodes in order in plain language. Flag anything the tool marks
   disabled, reserved or truncated, because those make the script invalid.
3. Use `lookup_opcode` for any opcode you'd otherwise be unsure about.

## Limits (tell the user when they matter)

- `estimate_script_cost` estimates the dominant charges: per-byte, pushed bytes,
  hash opcodes and fixed ZK costs. It is **not** the consensus value. ZK
  per-public-input verifying-key pricing can't be fully derived statically, and
  the output flags it when it applies.
- Everything is pinned to rusty-kaspa v2.1.0. After a consensus upgrade the opcode
  table and constants can be out of date. If the user is on a newer node, say so.
- The tools read scripts. They never sign, broadcast or touch keys or funds.
