// Human explanations for rusty-kaspa txscript errors (v2.1.0), keyed by a
// distinctive substring of the Display message. Aimed at covenant/Toccata devs
// who hit these with little context. Each entry: what it means + what to change.
interface ErrExpl {
  match: RegExp;
  title: string;
  meaning: string;
  fix: string;
}

const TABLE: ErrExpl[] = [
  {
    match: /script units exceeded the amount committed/i,
    title: "ExceededCommittedScriptUnits",
    meaning:
      "The script consumed more execution 'script units' than the compute budget the input committed to and paid for. Script units are charged for pushed bytes (1/byte), hash opcodes (1-2/byte hashed), ZK proofs (fixed), and sig ops. This is a metering limit, not a logic bug.",
    fix: "Raise the input's committed compute budget (ComputeBudget) so allowed_script_units covers the used amount, or make the script cheaper (fewer/smaller pushes, cheaper hash, avoid re-hashing large data). Use the estimate_cost tool to size the budget before signing.",
  },
  {
    match: /element size \d+ exceeds max allowed size|ElementTooBig/i,
    title: "ElementTooBig",
    meaning: "A single data element pushed to the stack is larger than MAX_SCRIPT_ELEMENT_SIZE (1,000,000 bytes).",
    fix: "Split the data or restructure so no single push exceeds 1 MB.",
  },
  {
    match: /script of size \d+ exceeded maximum allowed size|ScriptSize/i,
    title: "ScriptSize",
    meaning: "The whole script (signature script or script public key) is over MAX_SCRIPTS_SIZE (1,000,000 bytes).",
    fix: "Reduce script size. Note the block compute limit (500,000 grams) usually binds before this anyway.",
  },
  {
    match: /Number too big|NumberTooBig/i,
    title: "NumberTooBig",
    meaning: "A numeric operand exceeded the script number range (Kaspa uses 8-byte script integers).",
    fix: "Keep numeric values within int64 range; check arithmetic that could overflow.",
  },
  {
    match: /signature script is not push only|SignatureScriptNotPushOnly/i,
    title: "SignatureScriptNotPushOnly",
    meaning: "The input's signature script contains a non-push opcode. Signature scripts may only push data.",
    fix: "Move logic into the redeem/script-public-key; the sig script should only push signatures and the redeem script.",
  },
  {
    match: /end of script reached in conditional|ErrUnbalancedConditional/i,
    title: "ErrUnbalancedConditional",
    meaning: "An OpIf/OpNotIf was not closed by a matching OpEndIf before the script ended.",
    fix: "Balance every conditional with an OpEndIf.",
  },
  {
    match: /opcode requires at least \d+ but stack has only|InvalidStackOperation/i,
    title: "InvalidStackOperation",
    meaning: "An opcode needed more stack items than were present.",
    fix: "Ensure the sig script / prior ops push enough operands before this opcode.",
  },
  {
    match: /stack contains \d+ unexpected items|CleanStack/i,
    title: "CleanStack",
    meaning: "The script finished with more than one item on the stack. Kaspa requires a clean stack (exactly one truthy value) at the end.",
    fix: "Add OpDrop/OpNip or restructure so exactly one truthy item remains at the end.",
  },
  {
    match: /false stack entry at end|EvalFalse/i,
    title: "EvalFalse",
    meaning: "The script ended with a false (zero/empty) top stack item, so verification failed.",
    fix: "Ensure the spending conditions leave a truthy value on top (e.g. a successful OpCheckSig or OpEqual).",
  },
  {
    match: /attempt to execute disabled opcode|OpcodeDisabled/i,
    title: "OpcodeDisabled",
    meaning: "The script uses a disabled opcode (e.g. OpCat, OpMul, OpLShift, OpAnd/Or/Xor, OpSubstr). These are permanently disabled in Kaspa.",
    fix: "Remove the disabled opcode; achieve the effect with allowed opcodes or off-chain computation + on-chain check.",
  },
  {
    match: /attempt to execute reserved opcode|OpcodeReserved/i,
    title: "OpcodeReserved",
    meaning: "The script uses a reserved/illegal opcode (e.g. OpReserved, OpVer).",
    fix: "Remove it; these always fail execution.",
  },
  {
    match: /exceeded max operation limit|TooManyOperations/i,
    title: "TooManyOperations",
    meaning: "The script executed more non-push operations than MAX_OPS_PER_SCRIPT (1,000,000).",
    fix: "Reduce the number of executed opcodes.",
  },
  {
    match: /ZK Integrity|ZkIntegrity/i,
    title: "ZkIntegrity",
    meaning: "An OpZkPrecompile proof failed to parse or verify. Causes: wrong tag byte, malformed/compressed VK or proof bytes, public-input count mismatch, trailing bytes, unsupported hash function (RISC0 requires Poseidon2), or a proof that simply does not verify.",
    fix: "Check the stack layout for the tag (Groth16=0x20, RISC0=0x21), that VK/proof are canonically compressed with no trailing bytes, and that the declared public-input count matches. See zk_precompiles docs.",
  },
  {
    match: /invalid opcode length|MalformedPushSize/i,
    title: "MalformedPushSize",
    meaning: "A push opcode declared a length that doesn't fit the remaining script bytes.",
    fix: "Fix the push encoding; the disassemble tool will show where it truncates.",
  },
  {
    match: /opcode requires \d+ bytes, but script only has|MalformedPush/i,
    title: "MalformedPush",
    meaning: "A data push runs off the end of the script.",
    fix: "The script is truncated inside a push; check serialization.",
  },
];

export function explainError(errorText: string): { title: string; meaning: string; fix: string; matched: boolean } {
  for (const e of TABLE) {
    if (e.match.test(errorText)) return { title: e.title, meaning: e.meaning, fix: e.fix, matched: true };
  }
  return {
    title: "Unrecognized error",
    meaning: "No known txscript error pattern matched this text.",
    fix: "Paste the exact Display string from the node/SDK. Known families: metering (script units/ops), stack (clean/empty/false), opcode (disabled/reserved), push encoding, and ZK integrity.",
    matched: false,
  };
}
