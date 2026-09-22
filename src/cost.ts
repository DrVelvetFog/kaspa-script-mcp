import { disassemble } from "./disasm.js";

// Constants from rusty-kaspa @ v2.1.0 (consensus/core/src/mass/units.rs, config/params.rs).
const SCRIPT_UNITS_PER_GRAM = 100;
const MASS_PER_TX_BYTE = 1;
const BLOCK_COMPUTE_GRAMS = 500_000; // MAINNET_PARAMS.block_mass_limits.compute
// Hash opcode pricing: script units per byte hashed (opcodes/mod.rs HashOpcodePricing).
const HASH_UNITS_PER_BYTE: Record<number, number> = { 0xa8: 1 /*SHA256*/, 0xaa: 2 /*Blake2b*/, 0xa7: 2 /*Blake2bWithKey*/, 0xd9: 1 /*Blake3*/ };
// ZK precompile fixed costs in grams (zk_precompiles/tags.rs: Gram(1000*N)).
const ZK_TAG_GRAMS: Record<number, number> = { 0x20: 140_000 /*Groth16*/, 0x21: 250_000 /*RISC0*/ };

export interface CostEstimate {
  bytes: number;
  estimatedScriptUnits: number;
  computeMassGrams: number;
  percentOfBlockComputeLimit: number;
  minComputeBudgetPerInput: number;
  notes: string[];
  approximate: true;
}

/**
 * Approximate the compute cost of a script for an input. This mirrors the
 * dominant charges the engine applies: 1 gram per script byte, plus script
 * units for pushed data (1 unit/byte), hash opcodes (1-2 units/byte of the
 * hashed element), and fixed ZK precompile costs. It is an estimate, not the
 * consensus value; a data push's "hashed length" is taken as the preceding
 * push length where determinable.
 */
export function estimateCost(scriptHex: string): CostEstimate | { error: string } {
  const d = disassemble(scriptHex);
  if (d.error && d.tokens.length === 0) return { error: d.error };
  const notes: string[] = [];
  if (d.error) notes.push(`disassembly stopped early: ${d.error}`);

  let units = 0;
  let lastPushLen = 0;
  for (const t of d.tokens) {
    if (t.dataLen !== undefined) {
      units += t.dataLen; // pushed bytes charged 1:1 as script units
      lastPushLen = t.dataLen;
      continue;
    }
    if (t.opcode in HASH_UNITS_PER_BYTE) {
      units += lastPushLen * HASH_UNITS_PER_BYTE[t.opcode];
      lastPushLen = 32; // hash result pushed back is 32 bytes
      continue;
    }
    if (t.opcode === 0xa6 /*OpZkPrecompile*/) {
      notes.push("script uses OpZkPrecompile; ZK cost depends on the tag byte on the stack (Groth16 ~140000g, RISC0 ~250000g) plus per-public-input VK pricing — not fully derivable statically");
    }
  }
  const computeMassGrams = d.bytes * MASS_PER_TX_BYTE + units / SCRIPT_UNITS_PER_GRAM;
  // An input must commit a compute budget (u16) covering its script units.
  const minComputeBudgetPerInput = Math.ceil(units / (100 * SCRIPT_UNITS_PER_GRAM));
  if (minComputeBudgetPerInput > 65535)
    notes.push(`estimated compute budget ${minComputeBudgetPerInput} exceeds the u16 max (65535); this script cannot be committed in one input`);
  return {
    bytes: d.bytes,
    estimatedScriptUnits: units,
    computeMassGrams: Math.round(computeMassGrams),
    percentOfBlockComputeLimit: +((computeMassGrams / BLOCK_COMPUTE_GRAMS) * 100).toFixed(2),
    minComputeBudgetPerInput,
    notes,
    approximate: true,
  };
}
