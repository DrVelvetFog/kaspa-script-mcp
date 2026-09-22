#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { disassemble } from "./disasm.js";
import { estimateCost } from "./cost.js";
import { explainError } from "./errors.js";
import { OPCODES } from "./opcodes.js";

const server = new Server(
  { name: "kaspa-script-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "disassemble_script",
    description:
      "Disassemble a Kaspa (rusty-kaspa v2.1.0 / Toccata) script from hex into opcodes and data pushes, exactly as the engine's parser walks it. Flags disabled/reserved opcodes and truncated pushes.",
    inputSchema: {
      type: "object",
      properties: { script_hex: { type: "string", description: "Script bytes as hex (0x-prefixed or bare)." } },
      required: ["script_hex"],
    },
  },
  {
    name: "estimate_script_cost",
    description:
      "Estimate a Kaspa script's compute cost: script units, compute-mass grams, share of the 500,000-gram block compute limit, and the minimum per-input compute budget to commit. Approximate; use it to size a compute budget before signing and to avoid ExceededCommittedScriptUnits.",
    inputSchema: {
      type: "object",
      properties: { script_hex: { type: "string", description: "Script bytes as hex." } },
      required: ["script_hex"],
    },
  },
  {
    name: "explain_script_error",
    description:
      "Explain a rusty-kaspa txscript error message (e.g. 'script units exceeded...', 'stack contains N unexpected items', 'ZK Integrity: ...', disabled-opcode, push-encoding errors) in plain terms with a concrete fix.",
    inputSchema: {
      type: "object",
      properties: { error_text: { type: "string", description: "The exact error string from the node or SDK." } },
      required: ["error_text"],
    },
  },
  {
    name: "lookup_opcode",
    description: "Look up a Kaspa opcode by hex code (e.g. '0xa8') or by name (e.g. 'OpSHA256'). Returns code, name, disabled/illegal status.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Opcode hex code or name." } },
      required: ["query"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

const asText = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] });

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    switch (req.params.name) {
      case "disassemble_script":
        return asText(disassemble(String(args.script_hex ?? "")));
      case "estimate_script_cost":
        return asText(estimateCost(String(args.script_hex ?? "")));
      case "explain_script_error":
        return asText(explainError(String(args.error_text ?? "")));
      case "lookup_opcode": {
        const q = String(args.query ?? "").trim();
        let code = -1;
        if (/^0x[0-9a-f]+$/i.test(q)) code = parseInt(q, 16);
        else if (/^\d+$/.test(q)) code = parseInt(q, 10);
        else {
          const hit = Object.entries(OPCODES).find(([, v]) => v.name.toLowerCase() === q.toLowerCase());
          if (hit) code = Number(hit[0]);
        }
        const info = OPCODES[code];
        return asText(info ? { code: `0x${code.toString(16).padStart(2, "0")}`, ...info } : { error: `no opcode matches ${q}` });
      }
      default:
        return { content: [{ type: "text" as const, text: `unknown tool ${req.params.name}` }], isError: true };
    }
  } catch (e) {
    return { content: [{ type: "text" as const, text: `error: ${(e as Error).message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("kaspa-script-mcp v0.1.0 on stdio");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
