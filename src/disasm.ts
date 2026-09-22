import { OPCODES } from "./opcodes.js";

export interface DisasmToken {
  offset: number;
  opcode: number;
  name: string;
  dataHex?: string;
  dataLen?: number;
  note?: string;
}

export interface DisasmResult {
  tokens: DisasmToken[];
  bytes: number;
  error?: string;
}

const MAX_SCRIPTS_SIZE = 1_000_000; // rusty-kaspa lib.rs

function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (h.length % 2 !== 0) throw new Error("hex has an odd number of digits");
  if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error("hex contains non-hex characters");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** Disassemble a Kaspa script exactly as the engine's parser walks it. */
export function disassemble(scriptHex: string): DisasmResult {
  let script: Uint8Array;
  try {
    script = hexToBytes(scriptHex);
  } catch (e) {
    return { tokens: [], bytes: 0, error: (e as Error).message };
  }
  const tokens: DisasmToken[] = [];
  if (script.length > MAX_SCRIPTS_SIZE)
    return { tokens, bytes: script.length, error: `script is ${script.length} bytes, over the ${MAX_SCRIPTS_SIZE}-byte limit` };

  let i = 0;
  while (i < script.length) {
    const off = i;
    const op = script[i++];
    const info = OPCODES[op];
    const name = info?.name ?? `Op(unknown 0x${op.toString(16).padStart(2, "0")})`;
    // Direct data pushes: OpData1..OpData75 push exactly `op` bytes (codes 0x01..0x4b).
    if (op >= 0x01 && op <= 0x4b) {
      const n = op;
      if (i + n > script.length) {
        tokens.push({ offset: off, opcode: op, name, note: `truncated: needs ${n} data bytes, ${script.length - i} left` });
        return { tokens, bytes: script.length, error: "script ends inside a data push" };
      }
      tokens.push({ offset: off, opcode: op, name, dataHex: toHex(script.slice(i, i + n)), dataLen: n });
      i += n;
      continue;
    }
    // PushData1/2/4: length prefix of 1/2/4 little-endian bytes, then that many data bytes.
    if (op === 0x4c || op === 0x4d || op === 0x4e) {
      const pfx = op === 0x4c ? 1 : op === 0x4d ? 2 : 4;
      if (i + pfx > script.length) {
        tokens.push({ offset: off, opcode: op, name, note: "truncated length prefix" });
        return { tokens, bytes: script.length, error: "script ends inside a push length prefix" };
      }
      let n = 0;
      for (let k = 0; k < pfx; k++) n |= script[i + k] << (8 * k);
      n >>>= 0;
      i += pfx;
      if (i + n > script.length) {
        tokens.push({ offset: off, opcode: op, name, dataLen: n, note: `truncated: needs ${n} data bytes, ${script.length - i} left` });
        return { tokens, bytes: script.length, error: "script ends inside a data push" };
      }
      tokens.push({ offset: off, opcode: op, name, dataHex: toHex(script.slice(i, i + n)), dataLen: n });
      i += n;
      continue;
    }
    const note = info?.disabled ? "DISABLED opcode (execution fails)" : info?.illegal ? "reserved/illegal opcode (execution fails)" : undefined;
    tokens.push({ offset: off, opcode: op, name, note });
  }
  return { tokens, bytes: script.length };
}

export { hexToBytes, toHex };
