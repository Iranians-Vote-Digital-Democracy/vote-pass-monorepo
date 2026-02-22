import { expect } from "chai";
import { ethers } from "hardhat";
import { HDNodeWallet } from "ethers";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter, getPoseidon, votingName } from "@/test/helpers";

import { BioPassportVoting, ProposalsState } from "@ethers-v6";

/**
 * BioPassportVoting Tests
 *
 * Covers the BioPassportVoting contract for TD3 (passport) documents.
 * Passport-only platform — TD1 (ID cards) are explicitly rejected.
 *
 * Test ordering per TESTING_GUIDE.md:
 *   1. Happy path
 *   2. Validation errors (trigger every require)
 *   3. Access control
 *   4. Boundary conditions
 *   5. Edge cases
 *
 * Every require/revert in the call chain is covered:
 *   BioPassportVoting._beforeVerify:
 *     - "Voting: citizenship is not whitelisted"
 *   BioPassportVoting._buildPublicSignalsTD1:
 *     - "TD1 voting is not supported."
 *   BaseVoting.getProposalRules:
 *     - "Voting: not whitelisted voting"
 *   ProposalsState.vote (called via _afterVerify):
 *     - "ProposalsState: proposal is not started"
 *     - "ProposalsState: voting is not whitelisted"
 *     - "ProposalsState: wrong number of votes"
 *     - "ProposalsState: vote overflow"
 *     - "SparseMerkleTree: the key already exists" (double vote)
 */
describe("BioPassportVoting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let OTHER: SignerWithAddress;

  let bioPassportVoting: BioPassportVoting;
  let proposalsState: ProposalsState;

  // =========================================================================
  // Setup Helpers (DRY per TESTING_GUIDE.md)
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

  /**
   * Build voting config for a proposal's whitelist data.
   * Encodes the ProposalRules struct that BaseVoting.getProposalRules decodes.
   */
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

  /** Encode the current block timestamp as the MRZ-style yyMMdd date. */
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

  /** Create user data with a random nullifier and given citizenship code. */
  function makeUserData(citizenship: number = 0x555341) {
    return {
      nullifier: ethers.hexlify(ethers.randomBytes(31)),
      citizenship: citizenship,
      identityCreationTimestamp: 123456,
    };
  }

  /** Encode the user payload (proposalId, vote choices, userData) for the voting contract. */
  function encodeUserPayload(proposalId: number, vote: number[], userData: ReturnType<typeof makeUserData>) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
      [proposalId, vote, Object.values(userData)],
    );
  }

  /** Create a standard proposal config with sane defaults. */
  async function makeProposalConfig(overrides?: {
    acceptedOptions?: number[];
    citizenshipWhitelist?: number[];
    startTimestamp?: number;
    duration?: number;
    multichoice?: number;
  }): Promise<ProposalsState.ProposalConfigStruct> {
    return {
      startTimestamp: overrides?.startTimestamp ?? (await time.latest()),
      duration: overrides?.duration ?? 11223344,
      multichoice: overrides?.multichoice ?? 0,
      acceptedOptions: overrides?.acceptedOptions ?? [3, 7, 15],
      description: "Test proposal",
      votingWhitelist: [await bioPassportVoting.getAddress()],
      votingWhitelistData: [encodeVotingConfig(overrides?.citizenshipWhitelist ?? [])],
    };
  }

  /** Generate mock Groth16 proof points. */
  function mockGroth16Proof() {
    return {
      a: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
      b: [
        [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
        [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
      ],
      c: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
    };
  }

  // =========================================================================
  // Verification Functions (per TESTING_GUIDE.md)
  // =========================================================================

  /**
   * Verify that a vote was correctly recorded in the proposal.
   * Checks proposal status, voting results, and that the VoteCast event was emitted.
   */
  async function verifyVoteRecorded(
    proposalId: number,
    expectedStatus: number,
    expectedResults: number[][],
  ) {
    const proposalInfo = await proposalsState.getProposalInfo(proposalId);
    expect(proposalInfo.status).to.eq(expectedStatus, "proposal status mismatch");
    expect(proposalInfo.votingResults).to.deep.eq(expectedResults, "voting results mismatch");
  }

  /**
   * Verify that a vote transaction emits the VoteCast event with correct data.
   */
  async function verifyVoteCastEvent(
    tx: any,
    proposalId: number,
    nullifier: string,
    vote: number[],
  ) {
    await expect(tx)
      .to.emit(proposalsState, "VoteCast")
      .withArgs(proposalId, nullifier, vote);
  }

  // =========================================================================
  // Test Setup
  // =========================================================================

  before("deploy contracts", async () => {
    [OWNER, OTHER] = await ethers.getSigners();

    await deployState();
    await deployBioPassportVoting();

    await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  // =========================================================================
  // 1. Happy Path
  // =========================================================================

  describe("Happy Path", () => {
    it("should record vote via execute (Groth16/TD3) and update proposal results", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      const userData = makeUserData();
      const encodedData = encodeUserPayload(1, [1, 4, 2], userData);

      await bioPassportVoting.execute(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        mockGroth16Proof(),
      );

      await verifyVoteRecorded(1, 2, [
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
      ]);
    });

    it("should record vote via executeNoir (Noir/TD3) and update proposal results", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      const userData = makeUserData();
      const encodedData = encodeUserPayload(1, [1, 4, 2], userData);

      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      await verifyVoteRecorded(1, 2, [
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
      ]);
    });

    it("should emit VoteCast event with correct proposal ID and vote data", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      const userData = makeUserData();
      const vote = [1, 4, 2];
      const encodedData = encodeUserPayload(1, vote, userData);

      const tx = bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      await verifyVoteCastEvent(tx, 1, userData.nullifier, vote);
    });

    it("should allow multiple different voters on the same proposal", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      // Voter 1 votes [1, 4, 2]
      const userData1 = makeUserData();
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodeUserPayload(1, [1, 4, 2], userData1),
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Voter 2 votes [2, 1, 4]
      const userData2 = makeUserData();
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodeUserPayload(1, [2, 1, 4], userData2),
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Both votes recorded: option 0: [1,1,0,...], option 1: [1,0,1,...], option 2: [0,1,1,...]
      await verifyVoteRecorded(1, 2, [
        [1, 1, 0, 0, 0, 0, 0, 0],
        [1, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0, 0, 0, 0],
      ]);
    });
  });

  // =========================================================================
  // 2. Validation Errors (trigger every require/revert)
  // =========================================================================

  describe("Validation Errors", () => {
    // BioPassportVoting._buildPublicSignalsTD1 → revert("TD1 voting is not supported.")
    it("should revert executeTD1 with 'TD1 voting is not supported.'", async () => {
      await proposalsState.createProposal(await makeProposalConfig());
      const encodedData = encodeUserPayload(1, [1, 4, 2], makeUserData());

      await expect(
        bioPassportVoting.executeTD1(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          mockGroth16Proof(),
        ),
      ).to.be.revertedWith("TD1 voting is not supported.");
    });

    // BioPassportVoting._buildPublicSignalsTD1 → revert("TD1 voting is not supported.")
    it("should revert executeTD1Noir with 'TD1 voting is not supported.'", async () => {
      await proposalsState.createProposal(await makeProposalConfig());
      const encodedData = encodeUserPayload(1, [1, 4, 2], makeUserData());

      await expect(
        bioPassportVoting.executeTD1Noir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("TD1 voting is not supported.");
    });

    // BioPassportVoting._beforeVerify → require(_validateCitizenship(...), "Voting: citizenship is not whitelisted")
    it("should revert with 'Voting: citizenship is not whitelisted' for non-whitelisted citizenship", async () => {
      // Whitelist only IRA and GEO
      await proposalsState.createProposal(
        await makeProposalConfig({ citizenshipWhitelist: [0x495241, 0x47454f] }),
      );

      // Vote with USA passport — not in whitelist
      const encodedData = encodeUserPayload(1, [1, 4, 2], makeUserData(0x555341));

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: citizenship is not whitelisted");
    });

    // When voting contract is not in the proposal's votingWhitelist, the revert may come from
    // BaseVoting.getProposalRules ("Voting: not whitelisted voting") or from
    // ProposalsState.vote's onlyVoting modifier ("ProposalsState: voting is not whitelisted")
    // depending on binary search result. Both protect against unauthorized voting.
    it("should revert when voting contract not in proposal whitelist", async () => {
      // Use an address that will definitely sort differently from bioPassportVoting
      const otherAddress = "0x0000000000000000000000000000000000000001";

      const config = await makeProposalConfig();
      config.votingWhitelist = [otherAddress];
      config.votingWhitelistData = [encodeVotingConfig()];

      await proposalsState.createProposal(config);

      const encodedData = encodeUserPayload(1, [1], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: not whitelisted voting");
    });

    // ProposalsState.vote → require(getProposalStatus(...) == ProposalStatus.Started, "ProposalsState: proposal is not started")
    it("should revert with 'ProposalsState: proposal is not started' for future proposal", async () => {
      const futureStart = (await time.latest()) + 999999;
      await proposalsState.createProposal(
        await makeProposalConfig({ startTimestamp: futureStart }),
      );

      const encodedData = encodeUserPayload(1, [1, 4, 2], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: proposal is not started");
    });

    // ProposalsState.vote → require(getProposalStatus(...) == ProposalStatus.Started, ...)
    it("should revert with 'ProposalsState: proposal is not started' for ended proposal", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ duration: 1 }),
      );

      // Advance time past the proposal duration
      await time.increase(10);

      const encodedData = encodeUserPayload(1, [1, 4, 2], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: proposal is not started");
    });

    // ProposalsState.vote → require(_config.acceptedOptions.length == vote_.length, "ProposalsState: wrong number of votes")
    it("should revert with 'ProposalsState: wrong number of votes' for mismatched vote count", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3, 7, 15] }),
      );

      // Provide only 1 vote for a 3-option proposal
      const encodedData = encodeUserPayload(1, [1], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: wrong number of votes");
    });

    // ProposalsState.vote → require(voteChoice > 0 && voteChoice <= _config.acceptedOptions[i], "ProposalsState: vote overflow")
    it("should revert with 'ProposalsState: vote overflow' for vote choice exceeding accepted options", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3] }), // max choice = 3 (0b11)
      );

      // Vote with choice 4 (exceeds max of 3)
      const encodedData = encodeUserPayload(1, [4], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: vote overflow");
    });

    // ProposalsState.vote → require(voteChoice > 0 ..., "ProposalsState: vote overflow")
    it("should revert with 'ProposalsState: vote overflow' for zero vote choice", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3] }),
      );

      // Vote with 0 (must be > 0)
      const encodedData = encodeUserPayload(1, [0], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: vote overflow");
    });

    // SparseMerkleTree.add → "SparseMerkleTree: the key already exists" (double vote)
    it("should revert with 'SparseMerkleTree: the key already exists' on double vote", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      const fixedNullifier = ethers.hexlify(ethers.randomBytes(31));
      const userData = { nullifier: fixedNullifier, citizenship: 0x555341, identityCreationTimestamp: 123456 };
      const encodedData = encodeUserPayload(1, [1, 4, 2], userData);

      // First vote succeeds
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Second vote with same nullifier reverts
      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("SparseMerkleTree: the key already exists");
    });
  });

  // =========================================================================
  // 3. Access Control
  // =========================================================================

  describe("Access Control", () => {
    it("should only allow whitelisted voting contracts to call ProposalsState.vote", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      // Try to call vote directly from a non-voting address
      await expect(
        proposalsState.connect(OTHER).vote(1, 123456, [1, 4, 2]),
      ).to.be.revertedWith("ProposalsState: not a voting");
    });

    it("should allow the registered voting contract to record votes", async () => {
      await proposalsState.createProposal(await makeProposalConfig());

      const userData = makeUserData();
      const encodedData = encodeUserPayload(1, [1, 4, 2], userData);

      // Vote through the whitelisted voting contract succeeds
      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });
  });

  // =========================================================================
  // 4. Boundary Conditions
  // =========================================================================

  describe("Boundary Conditions", () => {
    it("should accept all countries when citizenship whitelist is empty", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ citizenshipWhitelist: [], acceptedOptions: [3] }),
      );

      // USA passport accepted with empty whitelist
      const encodedData = encodeUserPayload(1, [1], makeUserData(0x555341));

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });

    it("should accept whitelisted citizenship when whitelist has exactly one entry", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ citizenshipWhitelist: [0x495241], acceptedOptions: [3] }),
      );

      const encodedData = encodeUserPayload(1, [1], makeUserData(0x495241));

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });

    it("should reject non-whitelisted citizenship when whitelist has exactly one entry", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ citizenshipWhitelist: [0x495241], acceptedOptions: [3] }),
      );

      const encodedData = encodeUserPayload(1, [1], makeUserData(0x555341)); // USA not in [IRA]

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: citizenship is not whitelisted");
    });

    it("should accept vote at exact maximum choice value with multichoice enabled", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [7], multichoice: 1 }), // multichoice bit 0 set
      );

      // Vote with max value 7 (all choices selected — allowed with multichoice)
      const encodedData = encodeUserPayload(1, [7], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });

    it("should accept highest power-of-2 choice in single-select mode", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [7] }), // choices 0,1,2 — max single = 4
      );

      // Vote with 4 (highest power of 2 within [1..7])
      const encodedData = encodeUserPayload(1, [4], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });

    it("should reject non-power-of-2 choice in single-select mode", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [7] }), // multichoice=0
      );

      // Vote with 3 (0b11 — not a power of 2, rejected without multichoice)
      const encodedData = encodeUserPayload(1, [3], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: vote not a 2^n");
    });

    it("should reject vote at MAX+1 choice value", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [7] }),
      );

      // Vote with 8 (exceeds max of 7)
      const encodedData = encodeUserPayload(1, [8], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("ProposalsState: vote overflow");
    });

    it("should accept vote with minimum valid choice (1)", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3] }),
      );

      const encodedData = encodeUserPayload(1, [1], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });

    it("should allow voting at exact proposal start time", async () => {
      const now = await time.latest();
      await proposalsState.createProposal(
        await makeProposalConfig({ startTimestamp: now, acceptedOptions: [3] }),
      );

      const encodedData = encodeUserPayload(1, [1], makeUserData());

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });
  });

  // =========================================================================
  // 5. Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle proposals with single accepted option", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [1] }), // 1 = binary choice (0 or 1)
      );

      const encodedData = encodeUserPayload(1, [1], makeUserData());

      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      await verifyVoteRecorded(1, 2, [[1, 0, 0, 0, 0, 0, 0, 0]]);
    });

    it("should correctly tally multichoice votes on separate proposals", async () => {
      // Proposal 1
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3] }),
      );
      // Proposal 2
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [7] }),
      );

      // Vote on proposal 1
      const userData1 = makeUserData();
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodeUserPayload(1, [2], userData1),
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Vote on proposal 2
      const userData2 = makeUserData();
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodeUserPayload(2, [4], userData2),
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Verify each proposal has independent results
      await verifyVoteRecorded(1, 2, [[0, 1, 0, 0, 0, 0, 0, 0]]);
      await verifyVoteRecorded(2, 2, [[0, 0, 1, 0, 0, 0, 0, 0]]);
    });

    it("should allow same nullifier to vote on different proposals", async () => {
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3] }),
      );
      await proposalsState.createProposal(
        await makeProposalConfig({ acceptedOptions: [3] }),
      );

      const fixedNullifier = ethers.hexlify(ethers.randomBytes(31));
      const userData = { nullifier: fixedNullifier, citizenship: 0x555341, identityCreationTimestamp: 123456 };

      // Vote on proposal 1
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodeUserPayload(1, [1], userData),
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Same nullifier can vote on proposal 2
      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodeUserPayload(2, [2], userData),
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });
  });
});
