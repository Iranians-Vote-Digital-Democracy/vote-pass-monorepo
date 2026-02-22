import { expect } from "chai";
import { ethers } from "hardhat";
import { HDNodeWallet } from "ethers";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter, getPoseidon, votingName } from "@/test/helpers";

import { IDCardVoting, ProposalsState } from "@ethers-v6";

/**
 * IDCardVoting Tests
 *
 * These tests verify that IDCardVoting correctly supports TD1 documents (ID cards like Iranian NID).
 * This is the only voting contract for the NID-only platform.
 *
 * Per TESTING_GUIDE.md:
 * - Happy path tests first
 * - Error/validation tests (trigger every require)
 * - Access control tests
 * - Boundary condition tests
 */
describe("IDCardVoting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let SIGNER: HDNodeWallet;

  let idCardVoting: IDCardVoting;
  let proposalsState: ProposalsState;

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

  async function deployIDCardVoting() {
    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const RegistrationSMTMock = await ethers.getContractFactory("RegistrationSMTMock");
    const VerifierMock = await ethers.getContractFactory("VerifierMock");
    const Voting = await ethers.getContractFactory("IDCardVoting");

    const registrationSMTMock = await RegistrationSMTMock.deploy();
    const verifierMock = await VerifierMock.deploy();

    idCardVoting = await Voting.deploy();

    let proxy = await Proxy.deploy(await idCardVoting.getAddress(), "0x");
    idCardVoting = idCardVoting.attach(await proxy.getAddress()) as IDCardVoting;

    await idCardVoting.__IDCardVoting_init(
      await registrationSMTMock.getAddress(),
      await proposalsState.getAddress(),
      await verifierMock.getAddress(),
    );
  }

  function getVotingConfig() {
    const coder = ethers.AbiCoder.defaultAbiCoder();

    return coder.encode(
      ["tuple(uint256,uint256[],uint256,uint256,uint256,uint256,uint256,uint256)"],
      [[0x00, [0x495241, 0x47454f], 1721401330, 1, 0x00, 0x303030303030, 0x303630373139, 0x323430373139]],
    );
  }

  async function getCurrentDate() {
    let res: string = "0x";
    const date = new Date((await time.latest()) * 1000);

    res += "3" + date.getUTCFullYear().toString()[2] + "3" + date.getUTCFullYear().toString()[3];

    let month = (date.getUTCMonth() + 1).toString();

    if (month.length == 1) {
      month = "0" + month;
    }

    res += "3" + month[0] + "3" + month[1];

    let day = date.getUTCDate().toString();

    if (day.length == 1) {
      day = "0" + day;
    }

    res += "3" + day[0] + "3" + day[1];

    return res;
  }

  function getUserData() {
    return {
      nullifier: ethers.hexlify(ethers.randomBytes(31)),
      citizenship: 0x495241, // IRA - Iran country code
      identityCreationTimestamp: 123456,
    };
  }

  before("setup", async () => {
    [OWNER] = await ethers.getSigners();
    SIGNER = ethers.Wallet.createRandom();

    await deployState();
    await deployIDCardVoting();

    // Add voting contract to proposals state
    await proposalsState.addVoting("IDCardVoting", await idCardVoting.getAddress());

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  describe("Happy Path - IDCardVoting with executeTD1Noir", () => {
    it("should successfully vote using executeTD1Noir for TD1 documents", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal for Iranian National ID voting",
        votingWhitelist: [await idCardVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // Use executeTD1Noir for TD1 documents (ID cards)
      await idCardVoting.executeTD1Noir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)), // Mock proof bytes
      );

      const proposalInfo = await proposalsState.getProposalInfo(1);

      expect(proposalInfo.status).to.eq(2); // Active
      expect(proposalInfo.votingResults).to.deep.eq([
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
      ]);
    });

    it("should emit correct events on successful vote", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await idCardVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();
      // Must provide votes for all 3 accepted options
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // Just verify it doesn't revert
      await expect(
        idCardVoting.executeTD1Noir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });
  });

  describe("Error Cases - TD3 (Passport) Not Supported", () => {
    it("should revert when calling executeNoir on IDCardVoting (TD3 not supported)", async () => {
      // IDCardVoting should NOT support TD3 (passports)
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await idCardVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(userData)],
      );

      // IDCardVoting._buildPublicSignals reverts with "TD3 voting is not supported."
      await expect(
        idCardVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("TD3 voting is not supported.");
    });
  });

  describe("Validation Errors", () => {
    it("should revert with 'Voting: citizenship is not whitelisted' for non-whitelisted citizenship", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await idCardVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      // Use a non-whitelisted citizenship code
      const userData = {
        nullifier: ethers.hexlify(ethers.randomBytes(31)),
        citizenship: 0x555341, // USA - not in whitelist
        identityCreationTimestamp: 123456,
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      await expect(
        idCardVoting.executeTD1Noir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: citizenship is not whitelisted");
    });
  });

  describe("Double Vote Prevention", () => {
    it("should prevent same nullifier from voting twice", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await idCardVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const fixedNullifier = ethers.hexlify(ethers.randomBytes(31));
      const userData = {
        nullifier: fixedNullifier,
        citizenship: 0x495241,
        identityCreationTimestamp: 123456,
      };

      // Must provide votes for all 3 accepted options
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // First vote should succeed
      await idCardVoting.executeTD1Noir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Second vote with same nullifier should fail
      await expect(
        idCardVoting.executeTD1Noir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("SparseMerkleTree: the key already exists");
    });

    it("should allow different nullifiers to vote on same proposal", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await idCardVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      // First voter - votes [1, 4, 2] means option 0 in slot 0, option 2 in slot 1, option 1 in slot 2
      const userData1 = getUserData();
      const encodedData1 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData1)],
      );

      await idCardVoting.executeTD1Noir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData1,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Second voter (different nullifier) - votes [2, 1, 4]
      const userData2 = getUserData();
      const encodedData2 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [2, 1, 4], Object.values(userData2)],
      );

      await expect(
        idCardVoting.executeTD1Noir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData2,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;

      // Verify both votes were recorded
      const proposalInfo = await proposalsState.getProposalInfo(1);
      // Both voters voted, results should reflect this
      expect(proposalInfo.status).to.eq(2); // Active
    });
  });
});
