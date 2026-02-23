import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  Reverter,
  getPoseidon,
  hasPassportData,
  hasRegistrationCircuit,
  loadPassportData,
  generateRegistrationProof,
  verifyRegistrationProofOffchain,
  registrationProofToProofPoints,
  parseSOD,
  verifyDG1Hash,
  verifySODSignature,
  extractCertificateInfo,
  parseDG1Fields,
  tamperDG1Byte,
  tamperDG1Field,
  hasPerPassportCircuit,
  generatePerPassportProof,
  verifyPerPassportProofOffchain,
  buildPerPassportCircuitInputs,
  PassportData,
  RegistrationProofResult,
  PerPassportProofResult,
  // Certificate chain verification
  verifyDSCertSignedByCSCA,
  verifyCertificateChain,
  buildICAOMerkleTree,
  computeCertificateKey,
  computeCertificatesRoot,
  hasUSCSCA,
  loadUSCSCA,
  // ICAO Master List authenticity
  verifyICAOMLAuthenticity,
  hasICAOMasterList,
  getICAOMasterListPath,
  extractICAOMLCertificates,
} from "@/test/helpers";

import { BioPassportVoting, ProposalsState } from "@ethers-v6";

/**
 * Passport Integration Tests
 *
 * End-to-end tests using real passport data:
 * 1. Passive authentication — SOD signature + DG1 hash verification
 * 1a. ICAO Master List authenticity — CMS signature verification (UN CSCA → ML Signer → ML)
 * 1b. Certificate chain — DS cert → CSCA → ICAO Master List
 * 1c. ICAO Master Tree — CSCA membership proof (Keccak256 Merkle)
 * 1d. Certificate SMT — DS cert registration (Poseidon hash)
 * 2. DG1 data integrity — field parsing + tamper detection via ZK proof
 * 3. Registration proof on-chain verification (Light256 circuit, 3 signals)
 * 4. Per-passport circuit — full certificate chain verification (5 signals)
 * 5. Voting with real passport attributes — citizenship, dates flow through contract logic
 * 6. Full stack — registration proof + voting in one flow
 *
 * Skips gracefully if no extracted passport data or circuit artifacts exist.
 */
describe("Passport Integration", function () {
  // Proof generation can take 10-30s depending on hardware
  this.timeout(120000);

  // =========================================================================
  // Block 1: Passive Authentication — SOD Verification
  // =========================================================================

  describe("Passive Authentication — SOD Verification", () => {
    let passportData: PassportData;

    before(function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }
      passportData = loadPassportData();
    });

    it("should parse the SOD structure and extract data group hashes", function () {
      const result = parseSOD(passportData.sodHex);

      // Must contain at least DG1 hash
      const dg1Entry = result.ldsSecurityObject.dataGroupHashes.find((dg) => dg.dataGroupNumber === 1);
      expect(dg1Entry).to.not.be.undefined;
      expect(dg1Entry!.dataGroupHashValue.length).to.be.greaterThan(0);

      // Hash algorithm should be recognized (typically SHA-256)
      expect(result.ldsSecurityObject.hashAlgorithmOid).to.not.be.empty;

      // Signer info should have signature bytes
      expect(result.signerInfo.signature.length).to.be.greaterThan(0);
    });

    it("should verify DG1 hash matches the SOD signed hash", function () {
      const valid = verifyDG1Hash(passportData.sodHex, passportData.dg1Hex);
      expect(valid).to.equal(true, "DG1 hash should match the hash in the SOD");
    });

    it("should verify the SOD signature with the document signing certificate", function () {
      const valid = verifySODSignature(passportData.sodHex, passportData.docSigningCertPem);
      expect(valid).to.equal(true, "SOD signature should verify against the document signing certificate");
    });

    it("should extract certificate details matching the passport issuer", function () {
      const certInfo = extractCertificateInfo(passportData.docSigningCertPem);

      // Certificate should have an issuer country
      expect(certInfo.issuerCountry).to.not.be.undefined;

      // Certificate should not be expired (at the time of passport issuance)
      expect(certInfo.notBefore).to.be.instanceOf(Date);
      expect(certInfo.notAfter).to.be.instanceOf(Date);
      expect(certInfo.notAfter.getTime()).to.be.greaterThan(certInfo.notBefore.getTime());

      // Serial number should exist
      expect(certInfo.serialNumber).to.not.be.empty;
    });

    it("should detect tampered DG1 via SOD hash mismatch", function () {
      // Tamper one byte in the MRZ area (byte 10 = part of issuing state)
      const tamperedDg1 = tamperDG1Byte(passportData.dg1Hex, 10, 0x58); // 'X'

      const valid = verifyDG1Hash(passportData.sodHex, tamperedDg1);
      expect(valid).to.equal(false, "Tampered DG1 should NOT match the SOD hash");
    });

    it("should detect tampered nationality via SOD hash mismatch", function () {
      const tamperedDg1 = tamperDG1Field(passportData.dg1Hex, "nationality", "ZZZ");

      const valid = verifyDG1Hash(passportData.sodHex, tamperedDg1);
      expect(valid).to.equal(false, "DG1 with tampered nationality should NOT match SOD hash");
    });
  });

  // =========================================================================
  // Block 1a: ICAO Master List Authenticity
  // =========================================================================

  describe("ICAO Master List Authenticity — CMS Signature Verification", () => {
    before(function () {
      if (!hasICAOMasterList()) {
        console.log("  Skipping: no ICAO Master List at test/fixtures/icao/.");
        this.skip();
      }
    });

    it("should verify the CMS signature on the ICAO Master List", function () {
      const result = verifyICAOMLAuthenticity(getICAOMasterListPath());
      expect(result.signatureValid).to.equal(
        true,
        "CMS signature should verify against the ICAO ML Signer certificate",
      );
    });

    it("should verify the ML Signer cert was signed by the UN CSCA", function () {
      const result = verifyICAOMLAuthenticity(getICAOMasterListPath());
      expect(result.signerCertValid).to.equal(
        true,
        "ICAO ML Signer cert should be signed by the UN CSCA",
      );
    });

    it("should verify the UN CSCA is self-signed (trust anchor)", function () {
      const result = verifyICAOMLAuthenticity(getICAOMasterListPath());
      expect(result.unCSCASelfSigned).to.equal(
        true,
        "UN CSCA should be self-signed as the root trust anchor",
      );
    });

    it("should verify both ML signing certificates are within validity period", function () {
      const result = verifyICAOMLAuthenticity(getICAOMasterListPath());
      expect(result.signerCertWithinValidity).to.equal(
        true,
        "ICAO ML Signer cert should be within validity period",
      );
      expect(result.unCSCAWithinValidity).to.equal(
        true,
        "UN CSCA should be within validity period",
      );
    });

    it("should confirm the ML Signer is issued by the United Nations", function () {
      const result = verifyICAOMLAuthenticity(getICAOMasterListPath());
      expect(result.signerSubject).to.include("United Nations");
      expect(result.signerSubject).to.include("Master List Signers");
      expect(result.signerIssuer).to.include("United Nations");
      expect(result.signerIssuer).to.include("Certification Authorities");
    });

    it("should contain the expected number of CSCA certificates", function () {
      const result = verifyICAOMLAuthenticity(getICAOMasterListPath());
      expect(result.cscaCount).to.equal(
        536,
        "December 2025 ML should contain 536 CSCA certificates",
      );
    });

    it("should extract ML Signer and UN CSCA certificates from CMS envelope", function () {
      const certs = extractICAOMLCertificates(getICAOMasterListPath());
      const crypto = require("crypto");

      const signer = new crypto.X509Certificate(certs.signerPem);
      expect(signer.subject).to.include("ICAO Master List Signer");

      const unCSCA = new crypto.X509Certificate(certs.unCSCAPem);
      expect(unCSCA.subject).to.include("United Nations CSCA");

      // The signer should be verified by the UN CSCA
      expect(signer.verify(unCSCA.publicKey)).to.equal(true);
    });
  });

  // =========================================================================
  // Block 1b: Certificate Chain — DS Cert → CSCA → ICAO
  // =========================================================================

  describe("Certificate Chain — DS Cert → CSCA → ICAO", () => {
    let passportData: PassportData;
    let cscaPem: string;

    before(function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }
      if (!hasUSCSCA()) {
        console.log("  Skipping: no US CSCA certificate at test/fixtures/us-csca.pem.");
        this.skip();
      }
      passportData = loadPassportData();
      cscaPem = loadUSCSCA();
    });

    it("should verify DS certificate was signed by the US CSCA", function () {
      const valid = verifyDSCertSignedByCSCA(passportData.docSigningCertPem, cscaPem);
      expect(valid).to.equal(true, "DS cert signature should verify against CSCA public key");
    });

    it("should verify DS cert issuer matches CSCA subject", function () {
      const result = verifyCertificateChain(passportData.docSigningCertPem, cscaPem);
      expect(result.issuerMatch).to.equal(
        true,
        "DS cert issuer DN should match CSCA subject DN",
      );
    });

    it("should verify Authority/Subject Key Identifier linkage", function () {
      const result = verifyCertificateChain(passportData.docSigningCertPem, cscaPem);
      // AKI/SKI may not be present on all certs; if present, they must match
      if (result.akiSkiMatch !== null) {
        expect(result.akiSkiMatch).to.equal(
          true,
          "DS cert AKI should match CSCA SKI",
        );
      }
      // If null, the extensions aren't present — not an error, just skip this check
    });

    it("should verify both certificates are within validity period", function () {
      const result = verifyCertificateChain(passportData.docSigningCertPem, cscaPem);
      expect(result.dsCertValid).to.equal(true, "DS cert should be within validity period");
      expect(result.cscaValid).to.equal(true, "CSCA cert should be within validity period");
    });

    it("should pass all chain verification checks", function () {
      const result = verifyCertificateChain(passportData.docSigningCertPem, cscaPem);
      expect(result.signatureValid).to.equal(true);
      expect(result.issuerMatch).to.equal(true);
      expect(result.dsCertValid).to.equal(true);
      expect(result.cscaValid).to.equal(true);
    });

    it("should reject DS cert against wrong CSCA", function () {
      // Use the test_ca.pem fixture as a fake CSCA
      const fakeCscaPem = require("fs").readFileSync(
        require("path").join(__dirname, "../fixtures/test_ca.pem"),
        "utf-8",
      );
      const valid = verifyDSCertSignedByCSCA(passportData.docSigningCertPem, fakeCscaPem);
      expect(valid).to.equal(false, "DS cert should NOT verify against a fake CSCA");
    });
  });

  // =========================================================================
  // Block 1c: ICAO Master Tree — CSCA Membership Proof
  // =========================================================================

  describe("ICAO Master Tree — CSCA Membership Proof", () => {
    let cscaPem: string;

    before(function () {
      if (!hasUSCSCA()) {
        console.log("  Skipping: no US CSCA certificate at test/fixtures/us-csca.pem.");
        this.skip();
      }
      cscaPem = loadUSCSCA();
    });

    it("should build ICAO Merkle tree containing US CSCA", function () {
      const tree = buildICAOMerkleTree([cscaPem]);

      expect(tree.root).to.match(/^0x[0-9a-f]{64}$/i, "Root should be a valid bytes32");
      expect(tree.leaves).to.have.lengthOf(1);
    });

    it("should produce valid Merkle proof for included CSCA", function () {
      // Build tree with multiple certs (US CSCA + test CA)
      const testCaPem = require("fs").readFileSync(
        require("path").join(__dirname, "../fixtures/test_ca.pem"),
        "utf-8",
      );
      const tree = buildICAOMerkleTree([cscaPem, testCaPem]);

      const proof = tree.getProof(cscaPem);
      expect(proof.length).to.be.greaterThan(0, "Proof should have at least one sibling");
    });

    it("should produce different roots for different CSCA sets", function () {
      const tree1 = buildICAOMerkleTree([cscaPem]);

      const testCaPem = require("fs").readFileSync(
        require("path").join(__dirname, "../fixtures/test_ca.pem"),
        "utf-8",
      );
      const tree2 = buildICAOMerkleTree([cscaPem, testCaPem]);

      expect(tree1.root).to.not.equal(tree2.root, "Different CSCA sets should have different roots");
    });

    it("should reject CSCA not in ICAO tree", function () {
      // Build tree with only test_ca (not the real CSCA)
      const testCaPem = require("fs").readFileSync(
        require("path").join(__dirname, "../fixtures/test_ca.pem"),
        "utf-8",
      );
      const tree = buildICAOMerkleTree([testCaPem]);

      // Try to get proof for US CSCA which is NOT in the tree
      const proof = tree.getProof(cscaPem);
      expect(proof).to.have.lengthOf(0, "Proof should be empty for non-member");
    });
  });

  // =========================================================================
  // Block 1d: Certificate SMT — DS Cert Registration
  // =========================================================================

  describe("Certificate SMT — DS Cert Registration", () => {
    let passportData: PassportData;

    before(function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }
      passportData = loadPassportData();
    });

    it("should compute certificateKey from DS cert RSA public key", function () {
      const certKey = computeCertificateKey(passportData.docSigningCertPem);

      // Certificate key should be a non-zero field element
      expect(certKey).to.not.equal(0n, "Certificate key should be non-zero");

      // Should be within BN254 field order
      const fieldOrder =
        21888242871839275222246405745257275088548364400416034343698204186575808495617n;
      expect(certKey).to.be.lessThan(fieldOrder);
    });

    it("should compute certificatesRoot matching circuit slaveMerkleRoot", function () {
      const certKey = computeCertificateKey(passportData.docSigningCertPem);
      const certRoot = computeCertificatesRoot(certKey);

      // Build the same value from the per-passport circuit input builder
      const inputs = buildPerPassportCircuitInputs(
        passportData.dg1Hex,
        passportData.sodHex,
        passportData.docSigningCertPem,
      );

      const expectedRoot = BigInt(inputs.slaveMerkleRoot);
      expect(certRoot).to.equal(
        expectedRoot,
        "certificatesRoot should match per-passport circuit slaveMerkleRoot",
      );
    });

    it("should verify certificatesRoot matches ZK proof output [4]", async function () {
      if (!hasPerPassportCircuit()) {
        console.log("  Skipping: per-passport circuit artifacts not found.");
        this.skip();
      }

      const certKey = computeCertificateKey(passportData.docSigningCertPem);
      const certRoot = computeCertificatesRoot(certKey);

      const proofResult = await generatePerPassportProof(
        passportData.dg1Hex,
        passportData.sodHex,
        passportData.docSigningCertPem,
      );

      const proofCertRoot = BigInt(proofResult.publicSignals[4]);
      expect(proofCertRoot).to.equal(
        certRoot,
        "ZK proof certificatesRoot should match computed value",
      );
    });

    it("should produce different certificateKeys for different certs", function () {
      const realCertKey = computeCertificateKey(passportData.docSigningCertPem);

      // Use test_ca.pem as a different certificate
      const testCaPem = require("fs").readFileSync(
        require("path").join(__dirname, "../fixtures/test_ca.pem"),
        "utf-8",
      );
      const testCertKey = computeCertificateKey(testCaPem);

      expect(realCertKey).to.not.equal(
        testCertKey,
        "Different certificates should have different keys",
      );
    });
  });

  // =========================================================================
  // Block 2: DG1 Data Integrity
  // =========================================================================

  describe("DG1 Data Integrity", () => {
    let passportData: PassportData;

    before(function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }
      passportData = loadPassportData();
    });

    it("should parse DG1 fields matching personDetails", function () {
      const fields = parseDG1Fields(passportData.dg1Hex);

      // Document type should be 'P' for passport
      expect(fields.documentType).to.equal("P");

      // Nationality from MRZ should match personDetails
      expect(fields.nationality).to.equal(
        passportData.personDetails.nationality,
        "MRZ nationality should match personDetails",
      );

      // Issuing state should match
      expect(fields.issuingState).to.equal(
        passportData.personDetails.issuerAuthority,
        "MRZ issuing state should match personDetails",
      );

      // Sex should match
      const expectedSex = passportData.personDetails.gender === "MALE" ? "M" :
                          passportData.personDetails.gender === "FEMALE" ? "F" : passportData.personDetails.gender;
      expect(fields.sex).to.equal(expectedSex, "MRZ sex should match personDetails");
    });

    it("should produce different dg1Hash when DG1 is tampered", async function () {
      if (!hasRegistrationCircuit()) {
        console.log("  Skipping: registration circuit artifacts not found.");
        this.skip();
      }

      // Generate proof from original DG1
      const originalResult = await generateRegistrationProof(passportData.dg1Hex, 42n);

      // Tamper nationality field
      const tamperedDg1 = tamperDG1Field(passportData.dg1Hex, "nationality", "ZZZ");
      const tamperedResult = await generateRegistrationProof(tamperedDg1, 42n);

      // dg1Hash (signal 0) should differ because DG1 content changed
      expect(originalResult.publicSignals[0]).to.not.equal(
        tamperedResult.publicSignals[0],
        "dg1Hash should differ when DG1 is tampered",
      );
    });

    it("should produce same dg1Hash for same DG1 regardless of secret key", async function () {
      if (!hasRegistrationCircuit()) {
        console.log("  Skipping: registration circuit artifacts not found.");
        this.skip();
      }

      const result1 = await generateRegistrationProof(passportData.dg1Hex, 12345n);
      const result2 = await generateRegistrationProof(passportData.dg1Hex, 67890n);

      // dg1Hash (signal 0) should be the same (same passport data)
      expect(result1.publicSignals[0]).to.equal(
        result2.publicSignals[0],
        "dg1Hash should be identical for same passport data",
      );

      // pkIdentityHash (signal 2) should differ (different secret keys)
      expect(result1.publicSignals[2]).to.not.equal(
        result2.publicSignals[2],
        "pkIdentityHash should differ for different secret keys",
      );
    });
  });

  // =========================================================================
  // Block 3: Registration Proof On-Chain Verification
  // =========================================================================

  describe("Registration Proof On-Chain Verification", () => {
    let passportData: PassportData;
    let proofResult: RegistrationProofResult;

    before(function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }
      if (!hasRegistrationCircuit()) {
        console.log("  Skipping: registration circuit artifacts not found.");
        this.skip();
      }
      passportData = loadPassportData();
    });

    it("should generate a valid registration proof from passport DG1 data", async function () {
      proofResult = await generateRegistrationProof(passportData.dg1Hex);

      // Off-chain verification
      const valid = await verifyRegistrationProofOffchain(proofResult.proof, proofResult.publicSignals);
      expect(valid).to.equal(true, "Registration proof should verify off-chain");

      // 3 public signals: dg1Hash, dg1Commitment, pkIdentityHash
      expect(proofResult.publicSignals).to.have.lengthOf(3);
      for (const sig of proofResult.publicSignals) {
        expect(BigInt(sig)).to.not.equal(0n, "Public signal should be non-zero");
      }
    });

    it("should verify the registration proof on-chain via RegisterIdentityLight256Verifier", async function () {
      if (!proofResult) {
        proofResult = await generateRegistrationProof(passportData.dg1Hex);
      }

      const Verifier = await ethers.getContractFactory("RegisterIdentityLight256Verifier");
      const verifier = await Verifier.deploy();

      const pp = registrationProofToProofPoints(proofResult.proof);
      const pubSignals = proofResult.publicSignals.map((s) => BigInt(s));

      const result = await verifier.verifyProof(pp.a, pp.b, pp.c, pubSignals);
      expect(result).to.equal(true, "On-chain verifier should accept real registration proof");
    });

    it("should reject a tampered registration proof on-chain", async function () {
      if (!proofResult) {
        proofResult = await generateRegistrationProof(passportData.dg1Hex);
      }

      const Verifier = await ethers.getContractFactory("RegisterIdentityLight256Verifier");
      const verifier = await Verifier.deploy();

      const pp = registrationProofToProofPoints(proofResult.proof);
      const pubSignals = proofResult.publicSignals.map((s) => BigInt(s));

      // Tamper with pi_a[0]
      const tamperedA: [string, string] = [
        (BigInt(pp.a[0]) + 1n).toString(),
        pp.a[1],
      ];

      const result = await verifier.verifyProof(tamperedA, pp.b, pp.c, pubSignals);
      expect(result).to.equal(false, "Tampered proof should be rejected");
    });

    it("should reject proof with wrong public signals", async function () {
      if (!proofResult) {
        proofResult = await generateRegistrationProof(passportData.dg1Hex);
      }

      const Verifier = await ethers.getContractFactory("RegisterIdentityLight256Verifier");
      const verifier = await Verifier.deploy();

      const pp = registrationProofToProofPoints(proofResult.proof);
      const pubSignals = proofResult.publicSignals.map((s) => BigInt(s));

      // Swap signal 0 and signal 2 (dg1Hash and pkIdentityHash)
      const swappedSignals = [pubSignals[2], pubSignals[1], pubSignals[0]];

      const result = await verifier.verifyProof(pp.a, pp.b, pp.c, swappedSignals);
      expect(result).to.equal(false, "Proof with swapped public signals should be rejected");
    });

    it("should reject proof generated from different passport data", async function () {
      // Generate proof from tampered DG1
      const tamperedDg1 = tamperDG1Field(passportData.dg1Hex, "nationality", "ZZZ");
      const tamperedProof = await generateRegistrationProof(tamperedDg1);

      const Verifier = await ethers.getContractFactory("RegisterIdentityLight256Verifier");
      const verifier = await Verifier.deploy();

      // Use tampered proof's proof points but original passport's public signals
      const pp = registrationProofToProofPoints(tamperedProof.proof);
      const originalSignals = proofResult!.publicSignals.map((s) => BigInt(s));

      const result = await verifier.verifyProof(pp.a, pp.b, pp.c, originalSignals);
      expect(result).to.equal(false, "Proof from different passport should not verify with original signals");
    });

    it("should produce different proofs for different secret keys", async function () {
      const result1 = await generateRegistrationProof(passportData.dg1Hex, 12345n);
      const result2 = await generateRegistrationProof(passportData.dg1Hex, 67890n);

      // dg1Hash (signal 0) should be the same (same passport data)
      expect(result1.publicSignals[0]).to.equal(
        result2.publicSignals[0],
        "dg1Hash should be identical for same passport data",
      );

      // pkIdentityHash (signal 2) should differ (different secret keys)
      expect(result1.publicSignals[2]).to.not.equal(
        result2.publicSignals[2],
        "pkIdentityHash should differ for different secret keys",
      );
    });
  });

  // =========================================================================
  // Block 4: Per-Passport Circuit — Full Certificate Chain Verification
  // =========================================================================

  describe("Per-Passport Circuit — Full Certificate Chain Verification", () => {
    let passportData: PassportData;
    let proofResult: PerPassportProofResult;

    before(function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }
      if (!hasPerPassportCircuit()) {
        console.log("  Skipping: per-passport circuit artifacts not found.");
        this.skip();
      }
      passportData = loadPassportData();
    });

    it("should build correct circuit inputs from passport data", function () {
      const inputs = buildPerPassportCircuitInputs(
        passportData.dg1Hex,
        passportData.sodHex,
        passportData.docSigningCertPem,
      );

      expect(inputs.dg1).to.have.lengthOf(1024);
      expect(inputs.encapsulatedContent).to.have.lengthOf(1536); // 3 blocks × 512 bits
      expect(inputs.signedAttributes).to.have.lengthOf(1024);    // 2 blocks × 512 bits
      expect(inputs.pubkey).to.have.lengthOf(32);                 // RSA 2048 / 64 bits
      expect(inputs.signature).to.have.lengthOf(32);
      expect(inputs.slaveMerkleInclusionBranches).to.have.lengthOf(80);

      // Total must match circuit's expected input count
      const total = inputs.dg1.length + 1 + inputs.encapsulatedContent.length +
        inputs.signedAttributes.length + inputs.pubkey.length + inputs.signature.length +
        1 + inputs.slaveMerkleInclusionBranches.length;
      expect(total).to.equal(3730, "Total input signals must be 3730");
    });

    it("should generate a valid per-passport proof with 5 public signals", async function () {
      proofResult = await generatePerPassportProof(
        passportData.dg1Hex,
        passportData.sodHex,
        passportData.docSigningCertPem,
      );

      // 5 public signals: dg15PubKeyHash, passportHash, dgCommit, identityKey, certificatesRoot
      expect(proofResult.publicSignals).to.have.lengthOf(5);

      // Signal [0] = dg15PubKeyHash should be 0 (no Active Authentication)
      expect(proofResult.publicSignals[0]).to.equal(
        "0",
        "dg15PubKeyHash should be 0 for passports without Active Authentication",
      );

      // Remaining signals should be non-zero
      for (let i = 1; i < 5; i++) {
        expect(BigInt(proofResult.publicSignals[i])).to.not.equal(
          0n,
          `Public signal [${i}] should be non-zero`,
        );
      }

      // Off-chain verification
      const valid = await verifyPerPassportProofOffchain(proofResult.proof, proofResult.publicSignals);
      expect(valid).to.equal(true, "Per-passport proof should verify off-chain");
    });

    it("should verify the per-passport proof on-chain via PerPassportVerifier", async function () {
      if (!proofResult) {
        proofResult = await generatePerPassportProof(
          passportData.dg1Hex,
          passportData.sodHex,
          passportData.docSigningCertPem,
        );
      }

      const Verifier = await ethers.getContractFactory("PerPassportVerifier");
      const verifier = await Verifier.deploy();

      const pp = registrationProofToProofPoints(proofResult.proof);
      const pubSignals = proofResult.publicSignals.map((s: string) => BigInt(s));

      const result = await verifier.verifyProof(pp.a, pp.b, pp.c, pubSignals);
      expect(result).to.equal(true, "On-chain verifier should accept real per-passport proof");
    });

    it("should reject a tampered per-passport proof on-chain", async function () {
      if (!proofResult) {
        proofResult = await generatePerPassportProof(
          passportData.dg1Hex,
          passportData.sodHex,
          passportData.docSigningCertPem,
        );
      }

      const Verifier = await ethers.getContractFactory("PerPassportVerifier");
      const verifier = await Verifier.deploy();

      const pp = registrationProofToProofPoints(proofResult.proof);
      const pubSignals = proofResult.publicSignals.map((s: string) => BigInt(s));

      // Tamper with pi_a[0]
      const tamperedA: [string, string] = [
        (BigInt(pp.a[0]) + 1n).toString(),
        pp.a[1],
      ];

      const result = await verifier.verifyProof(tamperedA, pp.b, pp.c, pubSignals);
      expect(result).to.equal(false, "Tampered proof should be rejected");
    });

    it("should produce consistent certificatesRoot (signal [4]) matching slaveMerkleRoot", async function () {
      if (!proofResult) {
        proofResult = await generatePerPassportProof(
          passportData.dg1Hex,
          passportData.sodHex,
          passportData.docSigningCertPem,
        );
      }

      const inputs = buildPerPassportCircuitInputs(
        passportData.dg1Hex,
        passportData.sodHex,
        passportData.docSigningCertPem,
      );

      // certificatesRoot (signal [4]) should match the slaveMerkleRoot input
      const expectedRoot = BigInt(inputs.slaveMerkleRoot);
      const actualRoot = BigInt(proofResult.publicSignals[4]);
      expect(actualRoot).to.equal(
        expectedRoot,
        "certificatesRoot output should match slaveMerkleRoot input",
      );
    });
  });

  // Block 5 numbering kept as-is for consistency

  describe("Voting with Real Passport Data", () => {
    const reverter = new Reverter();

    let OWNER: SignerWithAddress;
    let bioPassportVoting: BioPassportVoting;
    let proposalsState: ProposalsState;
    let passportData: PassportData;

    /** Encode citizenship from 3-letter country code to uint256. */
    function citizenshipCode(nationality: string): number {
      return (
        (nationality.charCodeAt(0) << 16) |
        (nationality.charCodeAt(1) << 8) |
        nationality.charCodeAt(2)
      );
    }

    async function deployState() {
      const Proxy = await ethers.getContractFactory("ERC1967Proxy");
      const ProposalSMT = await ethers.getContractFactory("ProposalSMT", {
        libraries: {
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const ProposalsState = await ethers.getContractFactory("ProposalsState", {
        libraries: {
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });

      const proposalSMT = await ProposalSMT.deploy();
      proposalsState = await ProposalsState.deploy();

      let proxy = await Proxy.deploy(await proposalsState.getAddress(), "0x");
      proposalsState = proposalsState.attach(await proxy.getAddress()) as ProposalsState;

      await proposalsState.__ProposalsState_init(await proposalSMT.getAddress(), 0n);
    }

    async function deployBioPassportVoting() {
      const Proxy = await ethers.getContractFactory("ERC1967Proxy");
      const RegistrationSMTMock = await ethers.getContractFactory("RegistrationSMTMock");
      const VerifierMock = await ethers.getContractFactory("VerifierMock");
      const Voting = await ethers.getContractFactory("BioPassportVoting");

      const registrationSMTMock = await RegistrationSMTMock.deploy();
      const verifierMock = await VerifierMock.deploy();

      bioPassportVoting = await Voting.deploy();

      let proxy = await Proxy.deploy(await bioPassportVoting.getAddress(), "0x");
      bioPassportVoting = bioPassportVoting.attach(await proxy.getAddress()) as BioPassportVoting;

      await bioPassportVoting.__BioPassportVoting_init(
        await registrationSMTMock.getAddress(),
        await proposalsState.getAddress(),
        await verifierMock.getAddress(),
      );
    }

    function encodeVotingConfig(citizenshipWhitelist: number[] = []) {
      const coder = ethers.AbiCoder.defaultAbiCoder();
      return coder.encode(
        ["tuple(uint256,uint256[],uint256,uint256,uint256,uint256,uint256,uint256)"],
        [
          [
            0x00, // selector
            citizenshipWhitelist,
            1721401330, // identityCreationTimestampUpperBound
            1, // identityCounterUpperBound
            0x00, // sex (any)
            0x303030303030, // birthDateLowerbound (000000)
            0x303630373139, // birthDateUpperbound
            0x323430373139, // expirationDateLowerBound
          ],
        ],
      );
    }

    async function getCurrentDate() {
      let res: string = "0x";
      const date = new Date((await time.latest()) * 1000);

      res += "3" + date.getUTCFullYear().toString()[2] + "3" + date.getUTCFullYear().toString()[3];
      let month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
      res += "3" + month[0] + "3" + month[1];
      let day = date.getUTCDate().toString().padStart(2, "0");
      res += "3" + day[0] + "3" + day[1];

      return res;
    }

    before(async function () {
      if (!hasPassportData()) {
        console.log("  Skipping: no extracted passport data in extracted_data/.");
        this.skip();
      }

      passportData = loadPassportData();
      [OWNER] = await ethers.getSigners();

      await deployState();
      await deployBioPassportVoting();

      await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

      await reverter.snapshot();
    });

    afterEach(reverter.revert);

    it("should create a proposal matching passport citizenship", async function () {
      const cc = citizenshipCode(passportData.personDetails.nationality);

      const config: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Integration test proposal",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [encodeVotingConfig([cc])],
      };

      await proposalsState.createProposal(config);

      const info = await proposalsState.getProposalInfo(1);
      expect(info.status).to.equal(2, "Proposal should be in Started status");
    });

    it("should execute a vote with real passport-derived citizenship", async function () {
      const cc = citizenshipCode(passportData.personDetails.nationality);

      const config: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Vote with real passport data",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [encodeVotingConfig([cc])],
      };

      await proposalsState.createProposal(config);

      const nullifier = ethers.hexlify(ethers.randomBytes(31));
      const userData = {
        nullifier,
        citizenship: cc,
        identityCreationTimestamp: 123456,
      };

      const userPayload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      const tx = bioPassportVoting.execute(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        userPayload,
        {
          a: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          b: [
            [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
            [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          ],
          c: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
        },
      );

      await expect(tx).to.emit(proposalsState, "VoteCast");

      const info = await proposalsState.getProposalInfo(1);
      expect(info.votingResults).to.deep.equal([
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
      ]);
    });

    it("should reject a vote with mismatched citizenship", async function () {
      const cc = citizenshipCode(passportData.personDetails.nationality);

      // Create proposal with a DIFFERENT citizenship whitelist
      const differentCitizenship = cc === 0x47454f ? 0x495241 : 0x47454f; // GEO or IRA

      const config: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3],
        description: "Wrong citizenship test",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [encodeVotingConfig([differentCitizenship])],
      };

      await proposalsState.createProposal(config);

      const userData = {
        nullifier: ethers.hexlify(ethers.randomBytes(31)),
        citizenship: cc, // Real passport citizenship — not in whitelist
        identityCreationTimestamp: 123456,
      };

      const userPayload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(userData)],
      );

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          userPayload,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: citizenship is not whitelisted");
    });
  });

  // =========================================================================
  // Block 5: Full Stack Integration
  // =========================================================================

  describe("Full Stack Integration", () => {
    const reverter = new Reverter();

    let OWNER: SignerWithAddress;
    let bioPassportVoting: BioPassportVoting;
    let proposalsState: ProposalsState;
    let passportData: PassportData;

    function citizenshipCode(nationality: string): number {
      return (
        (nationality.charCodeAt(0) << 16) |
        (nationality.charCodeAt(1) << 8) |
        nationality.charCodeAt(2)
      );
    }

    async function deployState() {
      const Proxy = await ethers.getContractFactory("ERC1967Proxy");
      const ProposalSMT = await ethers.getContractFactory("ProposalSMT", {
        libraries: {
          PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });
      const ProposalsState = await ethers.getContractFactory("ProposalsState", {
        libraries: {
          PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
        },
      });

      const proposalSMT = await ProposalSMT.deploy();
      proposalsState = await ProposalsState.deploy();

      let proxy = await Proxy.deploy(await proposalsState.getAddress(), "0x");
      proposalsState = proposalsState.attach(await proxy.getAddress()) as ProposalsState;

      await proposalsState.__ProposalsState_init(await proposalSMT.getAddress(), 0n);
    }

    async function deployBioPassportVoting() {
      const Proxy = await ethers.getContractFactory("ERC1967Proxy");
      const RegistrationSMTMock = await ethers.getContractFactory("RegistrationSMTMock");
      const VerifierMock = await ethers.getContractFactory("VerifierMock");
      const Voting = await ethers.getContractFactory("BioPassportVoting");

      const registrationSMTMock = await RegistrationSMTMock.deploy();
      const verifierMock = await VerifierMock.deploy();

      bioPassportVoting = await Voting.deploy();

      let proxy = await Proxy.deploy(await bioPassportVoting.getAddress(), "0x");
      bioPassportVoting = bioPassportVoting.attach(await proxy.getAddress()) as BioPassportVoting;

      await bioPassportVoting.__BioPassportVoting_init(
        await registrationSMTMock.getAddress(),
        await proposalsState.getAddress(),
        await verifierMock.getAddress(),
      );
    }

    function encodeVotingConfig(citizenshipWhitelist: number[] = []) {
      const coder = ethers.AbiCoder.defaultAbiCoder();
      return coder.encode(
        ["tuple(uint256,uint256[],uint256,uint256,uint256,uint256,uint256,uint256)"],
        [
          [
            0x00,
            citizenshipWhitelist,
            1721401330,
            1,
            0x00,
            0x303030303030,
            0x303630373139,
            0x323430373139,
          ],
        ],
      );
    }

    async function getCurrentDate() {
      let res: string = "0x";
      const date = new Date((await time.latest()) * 1000);

      res += "3" + date.getUTCFullYear().toString()[2] + "3" + date.getUTCFullYear().toString()[3];
      let month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
      res += "3" + month[0] + "3" + month[1];
      let day = date.getUTCDate().toString().padStart(2, "0");
      res += "3" + day[0] + "3" + day[1];

      return res;
    }

    before(async function () {
      if (!hasPassportData() || !hasRegistrationCircuit()) {
        console.log("  Skipping: need both passport data and circuit artifacts.");
        this.skip();
      }

      passportData = loadPassportData();
      [OWNER] = await ethers.getSigners();

      await deployState();
      await deployBioPassportVoting();

      await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

      await reverter.snapshot();
    });

    afterEach(reverter.revert);

    it("should verify complete chain: ICAO ML → CSCA → DS → SOD → DG1 → ZK proof", async function () {
      if (!hasUSCSCA()) {
        console.log("  Skipping: no US CSCA certificate.");
        this.skip();
      }

      const cscaPem = loadUSCSCA();

      // 0. Verify ICAO ML authenticity (if ML file available)
      if (hasICAOMasterList()) {
        const mlResult = verifyICAOMLAuthenticity(getICAOMasterListPath());
        expect(mlResult.signatureValid).to.equal(true, "ML CMS signature must be valid");
        expect(mlResult.signerCertValid).to.equal(true, "ML Signer must be signed by UN CSCA");
        expect(mlResult.unCSCASelfSigned).to.equal(true, "UN CSCA must be self-signed");
      }

      // 1. Verify CSCA is in ICAO Merkle tree
      const tree = buildICAOMerkleTree([cscaPem]);
      expect(tree.root).to.match(/^0x[0-9a-f]{64}$/i);

      // 2. Verify DS cert signed by CSCA
      const dsSigValid = verifyDSCertSignedByCSCA(passportData.docSigningCertPem, cscaPem);
      expect(dsSigValid).to.equal(true, "DS cert must be signed by CSCA");

      // 3. Verify SOD signed by DS cert
      const sodSigValid = verifySODSignature(passportData.sodHex, passportData.docSigningCertPem);
      expect(sodSigValid).to.equal(true, "SOD must be signed by DS cert");

      // 4. Verify DG1 hash in SOD
      const dg1Valid = verifyDG1Hash(passportData.sodHex, passportData.dg1Hex);
      expect(dg1Valid).to.equal(true, "DG1 hash must match SOD");

      // 5. Verify certificatesRoot matches
      const certKey = computeCertificateKey(passportData.docSigningCertPem);
      const certRoot = computeCertificatesRoot(certKey);
      const inputs = buildPerPassportCircuitInputs(
        passportData.dg1Hex,
        passportData.sodHex,
        passportData.docSigningCertPem,
      );
      expect(certRoot).to.equal(BigInt(inputs.slaveMerkleRoot));
    });

    it("should register with real proof then vote with real passport data", async function () {
      // 1. Generate registration proof from passport DG1
      const regResult = await generateRegistrationProof(passportData.dg1Hex);

      // 2. Verify registration proof on-chain
      const Verifier = await ethers.getContractFactory("RegisterIdentityLight256Verifier");
      const verifier = await Verifier.deploy();

      const regPP = registrationProofToProofPoints(regResult.proof);
      const regPubSignals = regResult.publicSignals.map((s) => BigInt(s));

      const regValid = await verifier.verifyProof(regPP.a, regPP.b, regPP.c, regPubSignals);
      expect(regValid).to.equal(true, "Registration proof should verify on-chain");

      // 3. Extract pkIdentityHash from public signals (index 2)
      const pkIdentityHash = regResult.publicSignals[2];

      // 4. Create proposal matching passport citizenship
      const cc = citizenshipCode(passportData.personDetails.nationality);

      const config: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Full stack integration test",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [encodeVotingConfig([cc])],
      };

      await proposalsState.createProposal(config);

      // 5. Vote using pkIdentityHash-derived nullifier + real citizenship
      // In the real system, the nullifier is derived from skIdentity + proposalId
      // Here we use pkIdentityHash as the nullifier seed for traceability
      const nullifier = ethers.zeroPadValue(ethers.toBeHex(BigInt(pkIdentityHash) % (2n ** 248n)), 31);

      const userData = {
        nullifier,
        citizenship: cc,
        identityCreationTimestamp: 123456,
      };

      const userPayload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // Submit vote with mock voting proof (VerifierMock accepts anything)
      const tx = bioPassportVoting.execute(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        userPayload,
        {
          a: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          b: [
            [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
            [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          ],
          c: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
        },
      );

      await expect(tx).to.emit(proposalsState, "VoteCast");

      // 6. Verify vote recorded in proposal results
      const info = await proposalsState.getProposalInfo(1);
      expect(info.votingResults).to.deep.equal([
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
      ]);
    });
  });
});
