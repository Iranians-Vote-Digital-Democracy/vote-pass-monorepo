import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  Reverter,
  getPoseidon,
  hasProofData,
  loadProofData,
  proofToProofPoints,
} from "@/test/helpers";

import { BioPassportVoting, ProposalsState } from "@ethers-v6";

/**
 * BioPassportVoting — Real Proof Tests
 *
 * These tests use proof data exported from the Android device via PassportDataExporter.
 * They verify that the on-chain VotingVerifier accepts real Groth16 proofs generated
 * by the mobile app's vote_smt circuit.
 *
 * The entire suite skips gracefully if no extracted proof data exists.
 * Run: yarn test:realproof
 */
describe("BioPassportVoting (Real Proof)", function () {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;

  let bioPassportVoting: BioPassportVoting;
  let proposalsState: ProposalsState;

  // =========================================================================
  // Setup Helpers
  // =========================================================================

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

  async function deployBioPassportVotingWithRealVerifier() {
    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const RegistrationSMTMock = await ethers.getContractFactory("RegistrationSMTMock");
    const VotingVerifier = await ethers.getContractFactory("VotingVerifier");
    const Voting = await ethers.getContractFactory("BioPassportVoting");

    const registrationSMTMock = await RegistrationSMTMock.deploy();
    const votingVerifier = await VotingVerifier.deploy();

    bioPassportVoting = await Voting.deploy();

    let proxy = await Proxy.deploy(await bioPassportVoting.getAddress(), "0x");
    bioPassportVoting = bioPassportVoting.attach(await proxy.getAddress()) as BioPassportVoting;

    await bioPassportVoting.__BioPassportVoting_init(
      await registrationSMTMock.getAddress(),
      await proposalsState.getAddress(),
      await votingVerifier.getAddress(),
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

  // =========================================================================
  // Suite Guard
  // =========================================================================

  before(function () {
    if (!hasProofData()) {
      console.log("  Skipping: no extracted proof data found in extracted_data/.");
      console.log("  To generate: scan passport in app, submit a vote, then run:");
      console.log("    ./scripts/extract-passport-data.sh");
      this.skip();
    }
  });

  // =========================================================================
  // Tests
  // =========================================================================

  describe("VotingVerifier direct verification", () => {
    it("should verify a real proof directly on VotingVerifier", async () => {
      const VotingVerifier = await ethers.getContractFactory("VotingVerifier");
      const votingVerifier = await VotingVerifier.deploy();

      const proofData = loadProofData();
      const proofPoints = proofToProofPoints(proofData.proof);

      // Convert pub signals to uint256 array (24 elements for the verifier)
      const pubSignals = proofData.pubSignals.map((s) => BigInt(s));

      const result = await votingVerifier.verifyProof(
        proofPoints.a,
        proofPoints.b,
        proofPoints.c,
        pubSignals,
      );

      expect(result).to.equal(true, "Real proof should verify successfully");
    });

    it("should reject a tampered proof", async () => {
      const VotingVerifier = await ethers.getContractFactory("VotingVerifier");
      const votingVerifier = await VotingVerifier.deploy();

      const proofData = loadProofData();
      const proofPoints = proofToProofPoints(proofData.proof);
      const pubSignals = proofData.pubSignals.map((s) => BigInt(s));

      // Tamper with pi_a[0] by adding 1
      const tamperedA: [string, string] = [
        (BigInt(proofPoints.a[0]) + 1n).toString(),
        proofPoints.a[1],
      ];

      const result = await votingVerifier.verifyProof(
        tamperedA,
        proofPoints.b,
        proofPoints.c,
        pubSignals,
      );

      expect(result).to.equal(false, "Tampered proof should be rejected");
    });
  });

  describe("Full voting flow with real proof", () => {
    before(async function () {
      if (!hasProofData()) this.skip();

      [OWNER] = await ethers.getSigners();

      await deployState();
      await deployBioPassportVotingWithRealVerifier();

      await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

      await reverter.snapshot();
    });

    afterEach(reverter.revert);

    it("should execute a real vote through BioPassportVoting", async () => {
      const proofData = loadProofData();
      const vi = proofData.votingInputs;
      const proofPoints = proofToProofPoints(proofData.proof);

      // Create a proposal config that matches the proof's voting inputs
      const citizenshipCode = Number(vi.citizenship);
      const config: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Real proof test proposal",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [encodeVotingConfig(citizenshipCode > 0 ? [citizenshipCode] : [])],
      };

      await proposalsState.createProposal(config);

      // Encode user payload matching the proof's public signals
      const votes = vi.votes.map((v) => BigInt(v));
      const userPayload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [
          1, // proposalId
          votes,
          [BigInt(vi.nullifier), BigInt(vi.citizenship), BigInt(vi.identityCreationTimestamp)],
        ],
      );

      // Submit the real proof
      await expect(
        bioPassportVoting.execute(
          vi.registrationRootHex,
          BigInt(vi.currentDate),
          userPayload,
          proofPoints,
        ),
      ).to.not.be.reverted;
    });
  });
});
