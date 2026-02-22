/**
 * Standalone circuit test runner.
 *
 * Runs the registerIdentity_inid_ca circuit with a certificate outside of
 * Hardhat/Mocha for quick iteration.
 *
 * Usage:
 *   npx ts-node --transpile-only test/scripts/run-circuit-test.ts [cert.der] [ca_modulus.hex]
 *   npx ts-node --transpile-only test/scripts/run-circuit-test.ts --prove
 *
 * Defaults:
 *   cert.der       → test/fixtures/resignedreal_leaf.der
 *   ca_modulus.hex  → test/fixtures/ca_modulus.hex
 *
 * Proof generation uses the `bb` CLI (Barretenberg native binary) v0.66.0.
 * The @noir-lang/backend_barretenberg npm package cannot parse Noir 1.0.0 bytecode.
 */

import * as fs from "fs";
import * as path from "path";

async function main() {
  // Dynamic imports for ESM modules
  const { Noir } = await import("@noir-lang/noir_js");

  const { prepareCircuitInputs, parseCertificate } = await import(
    "../helpers/certificate-parser"
  );
  const { checkBBInstalled, generateProofWithBB, verifyProofWithBB } =
    await import("../helpers/bb-prover");

  const args = process.argv.slice(2);
  const positionalArgs = args.filter((a) => !a.startsWith("-"));
  const certPath =
    positionalArgs[0] ||
    path.join(__dirname, "../fixtures/resignedreal_leaf.der");
  const modulusPath =
    positionalArgs[1] ||
    path.join(__dirname, "../fixtures/ca_modulus.hex");

  // Load certificate
  console.log(`Certificate: ${certPath}`);
  const certBytes = new Uint8Array(fs.readFileSync(certPath));
  const parsed = parseCertificate(certBytes);
  console.log(`  TBS length: ${parsed.tbsLength} bytes`);
  console.log(`  Modulus bits: ${parsed.modulus.toString(2).length}`);

  // Load CA modulus
  console.log(`CA modulus: ${modulusPath}`);
  const caModulus = BigInt(
    "0x" + fs.readFileSync(modulusPath, "utf-8").trim()
  );

  // Load circuit
  const circuitPath = path.join(
    __dirname,
    "../../../../../mobile-Iranians.vote/assets/circuits/noir/register/inid/byte_code.json"
  );
  console.log(`Circuit: ${circuitPath}`);
  const circuit = JSON.parse(fs.readFileSync(circuitPath, "utf-8"));

  // Prepare inputs
  const skIdentity = BigInt("0x" + "ab".repeat(31));
  const inputs = prepareCircuitInputs(certBytes, skIdentity, caModulus);
  console.log(`\nCircuit inputs prepared:`);
  console.log(`  tbs: ${inputs.len} bytes (padded to ${inputs.tbs.length})`);
  console.log(`  pk chunks: ${inputs.pk.length}`);
  console.log(`  signature chunks: ${inputs.signature.length}`);
  console.log(`  reduction chunks: ${inputs.reduction.length}`);
  console.log(`  icao_root: ${inputs.icao_root.slice(0, 20)}...`);
  console.log(`  sk_identity: ${String(skIdentity).slice(0, 20)}...`);

  // Execute circuit (witness generation)
  console.log(`\n--- Witness Generation ---`);
  const noir = new Noir(circuit as any);

  const t0 = Date.now();
  const { witness } = await noir.execute(inputs);
  const witnessTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Witness generated in ${witnessTime}s`);

  // Generate proof using bb CLI
  const shouldProve = args.includes("--prove") || args.includes("-p");
  if (shouldProve) {
    const bbVersion = checkBBInstalled();
    console.log(`\n--- Proof Generation (bb CLI v${bbVersion}) ---`);

    const t1 = Date.now();
    const proof = generateProofWithBB(circuitPath, witness);
    const proofTime = ((Date.now() - t1) / 1000).toFixed(1);
    console.log(`Proof generated in ${proofTime}s`);
    console.log(`  Proof size: ${proof.length} bytes`);

    // Verify
    console.log(`\n--- Verification ---`);
    const t2 = Date.now();
    const isValid = verifyProofWithBB(circuitPath, proof);
    const verifyTime = ((Date.now() - t2) / 1000).toFixed(1);
    console.log(`Verification: ${isValid ? "PASS" : "FAIL"} (${verifyTime}s)`);

    if (!isValid) {
      process.exit(1);
    }
  } else {
    console.log(`\nSkipping proof generation (use --prove / -p to enable)`);
  }

  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
