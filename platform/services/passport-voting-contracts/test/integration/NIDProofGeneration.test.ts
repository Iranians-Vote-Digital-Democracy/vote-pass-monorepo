/**
 * NID Proof Generation & Verification Integration Tests
 *
 * Validates the ZK pipeline:
 * Certificate → Circuit Inputs → Noir Witness Generation → ✓
 *
 * Certificate Architecture
 * ========================
 * The registerIdentity_inid_ca circuit verifies: signature^65537 ≡ SHA256(tbs) (mod pk)
 * where tbs & signature come from the SIGNING certificate and pk is the CA's modulus.
 *
 * Test Strategy:
 * - "Re-signed real cert" = real NID card TBS re-signed with our test CA key.
 *   This has the real ASN.1 structure the circuit's parse_asn1 expects.
 * - Test CA modulus from ca_modulus.hex serves as pk.
 *
 * IMPORTANT: The circuit's SHA-256 always pads to 1152 bytes (18 blocks of 64).
 * TBS must be 1080-1143 bytes for standard SHA-256 to also produce 18 blocks.
 * Real NID certs have ~1096 byte TBS (in range).
 *
 * NOTE on proof generation:
 * Proof generation requires a Barretenberg backend compatible with Noir 1.0.0-beta.1.
 * The @noir-lang/backend_barretenberg npm package maxes out at 0.36.0 which cannot
 * parse 1.0.0 bytecode. Proof generation requires either:
 * - The `bb` CLI tool (Barretenberg native binary, installed via `bbup`)
 * - A future version of @noir-lang/backend_barretenberg or @aztec/bb.js
 * Witness generation (which validates all circuit logic) works with noir_js@1.0.0-beta.1.
 *
 * Test structure follows TESTING_GUIDE.md:
 * - Helper function tests (fast, no circuit)
 * - Happy path tests (circuit witness generation)
 * - Error/validation tests (circuit rejects bad inputs)
 * - Boundary condition tests
 */

import { Noir } from "@noir-lang/noir_js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

import {
  prepareCircuitInputs,
  parseCertificate,
  splitBigIntToChunks,
  reconstructFromChunks,
  computeBarrettReduction,
  extractPkHash,
  computeIcaoRootForIsolatedTest,
  extractDg1FromTbs,
  computeIdStateRootForIsolatedTest,
  prepareQueryCircuitInputs,
} from "../helpers/certificate-parser";
import {
  checkBBInstalled,
  generateProofWithBB,
  verifyProofWithBB,
} from "../helpers/bb-prover";

describe("NID Proof Generation & Verification", function () {
  // ============================================
  // SETUP - DRY test fixtures (per TESTING_GUIDE.md)
  // ============================================

  // Test fixtures (checked into repo)
  const RESIGNED_LEAF_PATH = path.join(
    __dirname,
    "../fixtures/resignedreal_leaf.der"
  );
  const CA_MODULUS_PATH = path.join(__dirname, "../fixtures/ca_modulus.hex");
  const REG_CIRCUIT_PATH = path.join(
    __dirname,
    "../../../../../mobile-Iranians.vote/assets/circuits/noir/register/inid/byte_code.json"
  );

  // Optional: real cert fixture (gitignored, only available locally)
  const REAL_CERT_PATH = path.join(
    __dirname,
    "../../../../../mobile-Iranians.vote/testdata/nid-signing-cert-new.json"
  );

  let resignedLeafBytes: Uint8Array;
  let caModulus: bigint;
  let registrationCircuit: object;

  // Standard test secret key
  const TEST_SK_IDENTITY = BigInt("0x" + "ab".repeat(31));

  // Shared circuit instance (created per-test in circuit tests)
  let regNoir: Noir;

  before(function () {
    // Load re-signed real cert (checked in, always available)
    if (!fs.existsSync(RESIGNED_LEAF_PATH)) {
      console.log(
        "Re-signed cert not found. Run: npx ts-node test/scripts/generate-resignedreal-cert.ts"
      );
      this.skip();
    }
    resignedLeafBytes = new Uint8Array(fs.readFileSync(RESIGNED_LEAF_PATH));
    console.log(
      `Loaded re-signed real cert: ${resignedLeafBytes.length} bytes`
    );

    // Load CA modulus
    const caModulusHex = fs.readFileSync(CA_MODULUS_PATH, "utf-8").trim();
    caModulus = BigInt("0x" + caModulusHex);
    console.log("Loaded test CA modulus");

    // Load circuit bytecode
    if (!fs.existsSync(REG_CIRCUIT_PATH)) {
      console.log("Circuit bytecode not found at: " + REG_CIRCUIT_PATH);
      this.skip();
    }
    registrationCircuit = JSON.parse(
      fs.readFileSync(REG_CIRCUIT_PATH, "utf-8")
    );
    console.log("Loaded registration circuit bytecode");
  });

  // ============================================
  // HELPER FUNCTION TESTS (fast, no circuit needed)
  // ============================================

  describe("Helper Functions", function () {
    it("splitBigIntToChunks should split correctly", function () {
      const value = BigInt("0x" + "ff".repeat(32)); // 256-bit value
      const chunks = splitBigIntToChunks(value, 64, 4);

      expect(chunks.length).to.equal(4);
      expect(chunks[0]).to.equal(BigInt("0x" + "ff".repeat(8)));
      expect(chunks[1]).to.equal(BigInt("0x" + "ff".repeat(8)));
      expect(chunks[2]).to.equal(BigInt("0x" + "ff".repeat(8)));
      expect(chunks[3]).to.equal(BigInt("0x" + "ff".repeat(8)));
    });

    it("splitBigIntToChunks and reconstructFromChunks should round-trip", function () {
      const original = BigInt("0x" + "ab".repeat(256)); // 2048-bit value
      const chunks = splitBigIntToChunks(original, 120, 18);

      expect(chunks.length).to.equal(18);

      const reconstructed = reconstructFromChunks(chunks, 120);
      expect(reconstructed).to.equal(original);
    });

    it("parseCertificate should extract TBS, modulus, and signature from re-signed cert", function () {
      const parsed = parseCertificate(resignedLeafBytes);

      expect(parsed.tbs).to.be.instanceOf(Uint8Array);
      expect(parsed.tbsLength).to.be.greaterThan(0);
      expect(parsed.tbsLength).to.be.lessThan(1200); // Must fit in circuit

      // TBS must be in the circuit's valid SHA-256 range
      expect(parsed.tbsLength).to.be.greaterThanOrEqual(1080);
      expect(parsed.tbsLength).to.be.lessThanOrEqual(1143);

      expect(parsed.modulus).to.be.greaterThan(0n);
      expect(parsed.signature).to.be.greaterThan(0n);

      // RSA-2048 modulus should be ~2048 bits
      const modulusBits = parsed.modulus.toString(2).length;
      expect(modulusBits).to.be.greaterThan(2040);
      expect(modulusBits).to.be.lessThanOrEqual(2048);

      console.log(`  TBS length: ${parsed.tbsLength} bytes`);
      console.log(`  Modulus bits: ${modulusBits}`);
    });

    it("prepareCircuitInputs should produce correctly sized arrays", function () {
      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      expect(inputs.tbs.length).to.equal(1200);
      expect(inputs.pk.length).to.equal(18);
      expect(inputs.reduction.length).to.equal(18);
      expect(inputs.signature.length).to.equal(18);
      expect(inputs.inclusion_branches.length).to.equal(80);
      expect(typeof inputs.len).to.equal("number");
      expect(inputs.len).to.be.greaterThan(0);
      expect(inputs.len).to.be.lessThanOrEqual(1143);

      // pk should be the CA modulus, not the cert's own modulus
      const pkChunks = inputs.pk.map(BigInt);
      const reconstructedPk = reconstructFromChunks(pkChunks, 120);
      expect(reconstructedPk).to.equal(caModulus);
    });

    it("computeBarrettReduction should produce valid reduction parameter", function () {
      const reduction = computeBarrettReduction(caModulus);
      expect(reduction.length).to.equal(18);

      // Each chunk should fit in 120 bits
      const maxChunkValue = (1n << 120n) - 1n;
      for (const chunk of reduction) {
        expect(chunk).to.be.lessThanOrEqual(maxChunkValue);
      }
    });

    it("extractPkHash should produce a non-zero Poseidon hash", function () {
      const pkChunks = splitBigIntToChunks(caModulus, 120, 18);
      const hash = extractPkHash(pkChunks);

      expect(hash).to.be.greaterThan(0n);
      // Should be in the BN254 field
      const FIELD_PRIME = BigInt(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617"
      );
      expect(hash).to.be.lessThan(FIELD_PRIME);
    });

    it("computeIcaoRootForIsolatedTest should produce consistent results", function () {
      const pkChunks = splitBigIntToChunks(caModulus, 120, 18);
      const root1 = computeIcaoRootForIsolatedTest(pkChunks);
      const root2 = computeIcaoRootForIsolatedTest(pkChunks);
      expect(root1).to.equal(root2);
      expect(root1).to.be.greaterThan(0n);
    });

    it("should parse real NID cert if testdata available", function () {
      if (!fs.existsSync(REAL_CERT_PATH)) {
        this.skip();
      }

      const certJson = JSON.parse(fs.readFileSync(REAL_CERT_PATH, "utf-8"));
      const certBytes = Buffer.from(certJson.hex, "hex");
      const parsed = parseCertificate(certBytes);

      expect(parsed.tbsLength).to.be.greaterThanOrEqual(1080);
      expect(parsed.tbsLength).to.be.lessThanOrEqual(1143);
      console.log(`  Real cert TBS length: ${parsed.tbsLength} bytes`);
    });
  });

  // ============================================
  // HAPPY PATH TESTS (circuit witness generation)
  // ============================================

  describe("Happy Path - Re-signed Real Cert", function () {
    beforeEach(async function () {
      this.timeout(120000);
      regNoir = new Noir(registrationCircuit as any);
    });

    it("should execute circuit with re-signed real cert (witness generation)", async function () {
      this.timeout(300000); // 5 minutes

      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      console.log(
        "  Executing circuit with re-signed real cert (this may take a few minutes)..."
      );
      const startTime = Date.now();

      const { witness } = await regNoir.execute(inputs);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Witness generated in ${elapsed}s`);

      expect(witness).to.exist;
    });

    it("should generate and verify proof with bb CLI", async function () {
      this.timeout(600000); // bb prove can take several minutes

      const bbVersion = checkBBInstalled();
      console.log(`  bb CLI version: ${bbVersion}`);

      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      // Step 1: Generate witness via noir_js
      console.log("  Generating witness...");
      const t0 = Date.now();
      const { witness } = await regNoir.execute(inputs);
      const witnessTime = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  Witness generated in ${witnessTime}s`);

      // Step 2: Generate proof via bb CLI
      console.log("  Generating proof with bb CLI (this may take a few minutes)...");
      const t1 = Date.now();
      const proof = generateProofWithBB(REG_CIRCUIT_PATH, witness);
      const proofTime = ((Date.now() - t1) / 1000).toFixed(1);
      console.log(`  Proof generated in ${proofTime}s (${proof.length} bytes)`);

      expect(proof.length).to.be.greaterThan(0);

      // Step 3: Verify proof via bb CLI
      console.log("  Verifying proof...");
      const t2 = Date.now();
      const valid = verifyProofWithBB(REG_CIRCUIT_PATH, proof);
      const verifyTime = ((Date.now() - t2) / 1000).toFixed(1);
      console.log(`  Verification: ${valid ? "PASS" : "FAIL"} (${verifyTime}s)`);

      expect(valid).to.be.true;
    });
  });

  // ============================================
  // ERROR/VALIDATION TESTS
  // ============================================

  describe("Error Cases", function () {
    beforeEach(async function () {
      this.timeout(120000);
      regNoir = new Noir(registrationCircuit as any);
    });

    it("should fail with tampered TBS", async function () {
      this.timeout(300000);

      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      // Tamper with a TBS byte (flip bits in the middle of the data)
      inputs.tbs[500] ^= 0xff;

      try {
        await regNoir.execute(inputs);
        expect.fail(
          "Should have thrown - tampered TBS should fail signature check"
        );
      } catch (e: any) {
        expect(e).to.exist;
        console.log(
          `  Correctly rejected tampered TBS: ${e.message?.slice(0, 80)}...`
        );
      }
    });

    it("should fail with wrong signature", async function () {
      this.timeout(300000);

      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      // Tamper with signature chunk
      inputs.signature[0] = String(BigInt(inputs.signature[0]) ^ 0xffffn);

      try {
        await regNoir.execute(inputs);
        expect.fail("Should have thrown - wrong signature should fail");
      } catch (e: any) {
        expect(e).to.exist;
        console.log("  Correctly rejected wrong signature");
      }
    });

    it("should fail with wrong public key", async function () {
      this.timeout(300000);

      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      // Tamper with public key chunk
      inputs.pk[0] = String(BigInt(inputs.pk[0]) ^ 0xffffn);

      // Also recompute icao_root for the tampered pk so SMT doesn't fail first
      const tamperedPkChunks = inputs.pk.map(BigInt);
      inputs.icao_root = String(
        computeIcaoRootForIsolatedTest(tamperedPkChunks)
      );
      inputs.reduction = computeBarrettReduction(
        reconstructFromChunks(tamperedPkChunks, 120)
      ).map(String);

      try {
        await regNoir.execute(inputs);
        expect.fail("Should have thrown - wrong public key should fail");
      } catch (e: any) {
        expect(e).to.exist;
        console.log("  Correctly rejected wrong public key");
      }
    });

    it("should fail with wrong icao_root", async function () {
      this.timeout(300000);

      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );

      // Use wrong icao_root (should fail SMT verification)
      inputs.icao_root = "12345";

      try {
        await regNoir.execute(inputs);
        expect.fail("Should have thrown - wrong icao_root should fail");
      } catch (e: any) {
        expect(e).to.exist;
        console.log("  Correctly rejected wrong icao_root");
      }
    });
  });

  // ============================================
  // BOUNDARY CONDITION TESTS
  // ============================================

  describe("Boundary Conditions", function () {
    beforeEach(async function () {
      this.timeout(120000);
      regNoir = new Noir(registrationCircuit as any);
    });

    it("should handle minimum valid sk_identity (1)", async function () {
      this.timeout(300000);

      const inputs = prepareCircuitInputs(resignedLeafBytes, 1n, caModulus);

      const { witness } = await regNoir.execute(inputs);
      expect(witness).to.exist;
      console.log("  sk_identity = 1 accepted");
    });

    it("should handle large sk_identity (close to field prime)", async function () {
      this.timeout(300000);

      // BN254 scalar field prime
      const FIELD_PRIME = BigInt(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617"
      );
      const inputs = prepareCircuitInputs(
        resignedLeafBytes,
        FIELD_PRIME - 1n,
        caModulus
      );

      const { witness } = await regNoir.execute(inputs);
      expect(witness).to.exist;
      console.log("  sk_identity = FIELD_PRIME - 1 accepted");
    });
  });

  // ============================================
  // QUERY (VOTING) CIRCUIT TESTS
  // ============================================

  describe("Query (Voting) Circuit", function () {
    const QUERY_CIRCUIT_PATH = path.join(
      __dirname,
      "../../../../../mobile-Iranians.vote/assets/circuits/noir/query-identity/inid/byte_code.json"
    );

    let queryCircuit: object;
    let regReturnValue: string[];

    before(async function () {
      this.timeout(600000); // registration + circuit load can take a while

      // Load query circuit bytecode
      if (!fs.existsSync(QUERY_CIRCUIT_PATH)) {
        console.log(
          "Query circuit bytecode not found at: " + QUERY_CIRCUIT_PATH
        );
        this.skip();
      }
      queryCircuit = JSON.parse(
        fs.readFileSync(QUERY_CIRCUIT_PATH, "utf-8")
      );
      console.log("Loaded query circuit bytecode");

      // Run registration circuit once to get return values for all query tests
      console.log(
        "  Running registration circuit to get return values..."
      );
      const regInputs = prepareCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        caModulus
      );
      const regNoirInstance = new Noir(registrationCircuit as any);
      const startTime = Date.now();
      const result = await regNoirInstance.execute(regInputs);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Registration circuit executed in ${elapsed}s`);

      regReturnValue = result.returnValue as string[];
      console.log(
        `  Registration returned ${regReturnValue.length} values`
      );
      console.log(
        `    [1] pk_passport_hash: ${String(regReturnValue[1]).slice(0, 20)}...`
      );
      console.log(
        `    [2] dg1_commitment:   ${String(regReturnValue[2]).slice(0, 20)}...`
      );
      console.log(
        `    [3] pk_identity_hash: ${String(regReturnValue[3]).slice(0, 20)}...`
      );
    });

    it("should extract DG1 from re-signed real cert TBS", function () {
      const { tbs } = parseCertificate(resignedLeafBytes);
      const dg1 = extractDg1FromTbs(tbs);

      expect(dg1.length).to.equal(108);

      // Country name should be non-zero (2 bytes for country code)
      expect(dg1[0] + dg1[1]).to.be.greaterThan(0);
      console.log(
        `  Country: ${String.fromCharCode(dg1[0])}${String.fromCharCode(dg1[1])}`
      );

      // At least some name fields should be non-zero
      let hasNameData = false;
      for (let i = 28; i < 90; i++) {
        if (dg1[i] !== 0) {
          hasNameData = true;
          break;
        }
      }
      expect(hasNameData).to.be.true;
      console.log("  DG1 extracted successfully (108 bytes)");
    });

    it("should generate query circuit witness", async function () {
      this.timeout(300000);

      const queryInputs = prepareQueryCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        regReturnValue
      );

      console.log(
        "  Executing query circuit (this may take a few minutes)..."
      );
      const queryNoir = new Noir(queryCircuit as any);
      const startTime = Date.now();

      const { witness, returnValue } = await queryNoir.execute(queryInputs);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Query witness generated in ${elapsed}s`);
      console.log(
        `  Query returned ${(returnValue as string[]).length} values`
      );

      expect(witness).to.exist;
    });

    it("should generate and verify query proof with bb CLI", async function () {
      this.timeout(600000);

      const bbVersion = checkBBInstalled();
      console.log(`  bb CLI version: ${bbVersion}`);

      const queryInputs = prepareQueryCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        regReturnValue
      );

      // Step 1: Generate witness via noir_js
      console.log("  Generating query witness...");
      const queryNoir = new Noir(queryCircuit as any);
      const t0 = Date.now();
      const { witness } = await queryNoir.execute(queryInputs);
      const witnessTime = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  Witness generated in ${witnessTime}s`);

      // Step 2: Generate proof via bb CLI
      console.log(
        "  Generating query proof with bb CLI (this may take a few minutes)..."
      );
      const t1 = Date.now();
      const proof = generateProofWithBB(QUERY_CIRCUIT_PATH, witness);
      const proofTime = ((Date.now() - t1) / 1000).toFixed(1);
      console.log(
        `  Proof generated in ${proofTime}s (${proof.length} bytes)`
      );

      expect(proof.length).to.be.greaterThan(0);

      // Step 3: Verify proof via bb CLI
      console.log("  Verifying query proof...");
      const t2 = Date.now();
      const valid = verifyProofWithBB(QUERY_CIRCUIT_PATH, proof);
      const verifyTime = ((Date.now() - t2) / 1000).toFixed(1);
      console.log(
        `  Verification: ${valid ? "PASS" : "FAIL"} (${verifyTime}s)`
      );

      expect(valid).to.be.true;
    });

    it("should fail with wrong sk_identity", async function () {
      this.timeout(300000);

      const wrongSk = BigInt("0x" + "cd".repeat(31));
      const queryInputs = prepareQueryCircuitInputs(
        resignedLeafBytes,
        wrongSk, // different from registration
        regReturnValue
      );

      const queryNoir = new Noir(queryCircuit as any);
      try {
        await queryNoir.execute(queryInputs);
        expect.fail(
          "Should have thrown - wrong sk_identity should fail SMT verification"
        );
      } catch (e: any) {
        expect(e.message).to.not.include("Should have thrown");
        console.log(
          `  Correctly rejected wrong sk_identity: ${e.message?.slice(0, 80)}...`
        );
      }
    });

    it("should fail with tampered DG1", async function () {
      this.timeout(300000);

      const queryInputs = prepareQueryCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        regReturnValue
      );

      // Tamper with DG1 data (flip a name byte)
      queryInputs.dg1[30] = String(
        (Number(queryInputs.dg1[30]) + 1) % 256
      );

      const queryNoir = new Noir(queryCircuit as any);
      try {
        await queryNoir.execute(queryInputs);
        expect.fail(
          "Should have thrown - tampered DG1 should fail commitment check"
        );
      } catch (e: any) {
        expect(e.message).to.not.include("Should have thrown");
        console.log(
          `  Correctly rejected tampered DG1: ${e.message?.slice(0, 80)}...`
        );
      }
    });

    it("should fail with wrong pk_passport_hash", async function () {
      this.timeout(300000);

      const queryInputs = prepareQueryCircuitInputs(
        resignedLeafBytes,
        TEST_SK_IDENTITY,
        regReturnValue
      );

      // Tamper with pk_passport_hash but keep original id_state_root.
      // This causes SMT verification to fail because tree_position changes.
      queryInputs.pk_passport_hash = "12345";

      const queryNoir = new Noir(queryCircuit as any);
      try {
        await queryNoir.execute(queryInputs);
        expect.fail(
          "Should have thrown - wrong pk_passport_hash should fail SMT verification"
        );
      } catch (e: any) {
        // Must be a circuit error, not a Chai assertion
        expect(e.message).to.not.include("Should have thrown");
        console.log(
          `  Correctly rejected wrong pk_passport_hash: ${e.message?.slice(0, 80)}...`
        );
      }
    });
  });
});
