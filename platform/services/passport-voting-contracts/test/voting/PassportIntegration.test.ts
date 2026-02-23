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
  PassportData,
  RegistrationProofResult,
} from "@/test/helpers";

import { BioPassportVoting, ProposalsState } from "@ethers-v6";

/**
 * Passport Integration Tests
 *
 * End-to-end tests using real passport data:
 * 1. Registration proof generation — real DG1 → Groth16 proof → on-chain verification
 * 2. Voting with real passport attributes — citizenship, dates flow through contract logic
 * 3. Full stack — registration proof + voting in one flow
 *
 * Skips gracefully if no extracted passport data or circuit artifacts exist.
 */
describe("Passport Integration", function () {
  // Proof generation can take 10-30s depending on hardware
  this.timeout(120000);

  // =========================================================================
  // Block 1: Registration Proof Generation
  // =========================================================================

  describe("Registration Proof Generation", () => {
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
  // Block 2: Voting with Real Passport Data
  // =========================================================================

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
  // Block 3: Full Stack Integration
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
