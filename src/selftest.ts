// Cross-checks the pure-TS tools against known-good rusty-kaspa scripts.
import { disassemble } from "./disasm.js";
import { estimateCost } from "./cost.js";
import { explainError } from "./errors.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; } else { fail++; console.error(`FAIL: ${name} ${detail}`); }
}

// 1. A P2SH-style push of a 32-byte hash then OpEqual-ish: build "20 <32 bytes> 87".
const h32 = "aa".repeat(32);
const p2 = disassemble(`20${h32}87`);
check("p2sh push len", p2.tokens[0]?.dataLen === 32, JSON.stringify(p2.tokens[0]));
check("p2sh push data", p2.tokens[0]?.dataHex === h32);
check("p2sh trailing op", p2.tokens[1]?.opcode === 0x87);
check("p2sh no error", !p2.error);

// 2. PushData1 (0x4c) with length 0x02 then 2 bytes.
const pd = disassemble("4c02dead");
check("pushdata1 len", pd.tokens[0]?.dataLen === 2, JSON.stringify(pd.tokens[0]));
check("pushdata1 data", pd.tokens[0]?.dataHex === "dead");

// 3. Truncated push is reported, not crashed.
const tr = disassemble("05aabb");
check("truncated push error", !!tr.error, JSON.stringify(tr));

// 4. Disabled opcode flagged (OpCat = 0x7e).
const dis = disassemble("7e");
check("disabled flagged", /DISABLED/.test(dis.tokens[0]?.note ?? ""), JSON.stringify(dis.tokens[0]));

// 5. Odd hex rejected.
check("odd hex error", !!disassemble("abc").error);

// 6. Cost: pushing 100 bytes should cost ~100 script units + 101 script bytes.
//    0x4c 0x64 <100 bytes> = PushData1 of 100.
const cost = estimateCost(`4c64${"42".repeat(100)}`);
if ("error" in cost) { check("cost no error", false, cost.error); }
else {
  check("cost units≈100", cost.estimatedScriptUnits === 100, `units=${cost.estimatedScriptUnits}`);
  check("cost bytes=102", cost.bytes === 102, `bytes=${cost.bytes}`);
  check("cost grams", cost.computeMassGrams === 103, `grams=${cost.computeMassGrams}`); // 102 + 100/100
}

// 7. SHA256 over a 520-byte push charges 520 units for the hash (1/byte) + 520 for the push.
const shaCost = estimateCost(`4d0802${"42".repeat(520)}a8`); // PushData2 len=520, then OpSHA256
if (!("error" in shaCost)) check("sha256 units≈1040", shaCost.estimatedScriptUnits === 1040, `units=${shaCost.estimatedScriptUnits}`);

// 8. Error explainer maps the real messages.
check("expl script units", explainError("script units exceeded the amount committed in the input: used=3, limit=2").title === "ExceededCommittedScriptUnits");
check("expl clean stack", explainError("stack contains 4 unexpected items").title === "CleanStack");
check("expl zk", explainError("ZK Integrity: Tag byte is missing").title === "ZkIntegrity");
check("expl unknown", explainError("some random text").matched === false);

console.log(`\nselftest: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
