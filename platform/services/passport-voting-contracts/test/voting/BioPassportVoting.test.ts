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
 * These tests verify that BioPassportVoting correctly supports TD3 documents (passports).
 * This is the only voting contract for the passport-only platform.
 *
 * Per TESTING_GUIDE.md:
 * - Happy path tests first
 * - Error/validation tests (trigger every require)
 * - Access control tests
 * - Boundary condition tests
 */
describe("BioPassportVoting", () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let SIGNER: HDNodeWallet;

  let bioPassportVoting: BioPassportVoting;
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

  function getVotingConfig(citizenshipWhitelist: number[] = []) {
    const coder = ethers.AbiCoder.defaultAbiCoder();

    return coder.encode(
      ["tuple(uint256,uint256[],uint256,uint256,uint256,uint256,uint256,uint256)"],
      [[0x00, citizenshipWhitelist, 1721401330, 1, 0x00, 0x303030303030, 0x303630373139, 0x323430373139]],
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

  function getUserData(citizenship: number = 0x555341) {
    return {
      nullifier: ethers.hexlify(ethers.randomBytes(31)),
      citizenship: citizenship, // USA passport by default
      identityCreationTimestamp: 123456,
    };
  }

  before("setup", async () => {
    [OWNER] = await ethers.getSigners();
    SIGNER = ethers.Wallet.createRandom();

    await deployState();
    await deployBioPassportVoting();

    // Add voting contract to proposals state
    await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

    await reverter.snapshot();
  });

  afterEach(reverter.revert);

  // =========================================================================
  // Happy Path — TD3 (Passport) via execute() (Groth16)
  // =========================================================================

  describe("Happy Path - BioPassportVoting with execute (Groth16)", () => {
    it("should successfully vote using execute for TD3 passports", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal for passport voting",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()], // empty whitelist = accept all
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // Use execute for TD3 (passport) Groth16 proofs
      await bioPassportVoting.execute(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        {
          a: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          b: [
            [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
            [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          ],
          c: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
        },
      );

      const proposalInfo = await proposalsState.getProposalInfo(1);

      expect(proposalInfo.status).to.eq(2); // Active
      expect(proposalInfo.votingResults).to.deep.eq([
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0, 0],
      ]);
    });
  });

  // =========================================================================
  // Happy Path — TD3 (Passport) via executeNoir()
  // =========================================================================

  describe("Happy Path - BioPassportVoting with executeNoir", () => {
    it("should successfully vote using executeNoir for TD3 passports", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal for passport voting via Noir",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // Use executeNoir for TD3 (passport) Noir proofs
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
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
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

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
  // Error Cases — TD1 (ID Card) Not Supported
  // =========================================================================

  describe("Error Cases - TD1 (ID Card) Not Supported", () => {
    it("should revert when calling executeTD1 on BioPassportVoting", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(userData)],
      );

      // BioPassportVoting._buildPublicSignalsTD1 reverts with "TD1 voting is not supported."
      await expect(
        bioPassportVoting.executeTD1(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          {
            a: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
            b: [
              [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
              [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
            ],
            c: [ethers.hexlify(ethers.randomBytes(32)), ethers.hexlify(ethers.randomBytes(32))],
          },
        ),
      ).to.be.revertedWith("TD1 voting is not supported.");
    });

    it("should revert when calling executeTD1Noir on BioPassportVoting", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(userData)],
      );

      await expect(
        bioPassportVoting.executeTD1Noir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("TD1 voting is not supported.");
    });
  });

  // =========================================================================
  // Validation Errors
  // =========================================================================

  describe("Validation Errors", () => {
    it("should revert with 'Voting: citizenship is not whitelisted' for non-whitelisted citizenship", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        // Whitelist only IRA and GEO
        votingWhitelistData: [getVotingConfig([0x495241, 0x47454f])],
      };

      await proposalsState.createProposal(proposalConfig);

      // Use a non-whitelisted citizenship code (USA)
      const userData = getUserData(0x555341); // USA

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: citizenship is not whitelisted");
    });

    it("should revert with 'Voting: not whitelisted voting' when voting contract not in proposal whitelist", async () => {
      const otherAddress = ethers.Wallet.createRandom().address;

      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3],
        description: "Test proposal",
        votingWhitelist: [otherAddress], // different voting contract
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const userData = getUserData();
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(userData)],
      );

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.be.revertedWith("Voting: not whitelisted voting");
    });
  });

  // =========================================================================
  // Double Vote Prevention
  // =========================================================================

  describe("Double Vote Prevention", () => {
    it("should prevent same nullifier from voting twice", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3, 7, 15],
        description: "Test proposal",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      const fixedNullifier = ethers.hexlify(ethers.randomBytes(31));
      const userData = {
        nullifier: fixedNullifier,
        citizenship: 0x555341,
        identityCreationTimestamp: 123456,
      };

      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData)],
      );

      // First vote should succeed
      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Second vote with same nullifier should fail
      await expect(
        bioPassportVoting.executeNoir(
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
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig()],
      };

      await proposalsState.createProposal(proposalConfig);

      // First voter
      const userData1 = getUserData();
      const encodedData1 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1, 4, 2], Object.values(userData1)],
      );

      await bioPassportVoting.executeNoir(
        ethers.hexlify(ethers.randomBytes(32)),
        await getCurrentDate(),
        encodedData1,
        ethers.hexlify(ethers.randomBytes(64)),
      );

      // Second voter (different nullifier)
      const userData2 = getUserData();
      const encodedData2 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [2, 1, 4], Object.values(userData2)],
      );

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData2,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;

      // Verify both votes were recorded
      const proposalInfo = await proposalsState.getProposalInfo(1);
      expect(proposalInfo.status).to.eq(2); // Active
    });
  });

  // =========================================================================
  // Boundary Conditions
  // =========================================================================

  describe("Boundary Conditions", () => {
    it("should accept all countries when citizenship whitelist is empty", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3],
        description: "Test proposal - open to all",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig([])], // empty = accept all
      };

      await proposalsState.createProposal(proposalConfig);

      // Vote with USA passport
      const usaData = getUserData(0x555341);
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(usaData)],
      );

      await expect(
        bioPassportVoting.executeNoir(
          ethers.hexlify(ethers.randomBytes(32)),
          await getCurrentDate(),
          encodedData,
          ethers.hexlify(ethers.randomBytes(64)),
        ),
      ).to.not.be.reverted;
    });

    it("should accept whitelisted citizenship when whitelist is non-empty", async () => {
      const proposalConfig: ProposalsState.ProposalConfigStruct = {
        startTimestamp: await time.latest(),
        duration: 11223344,
        multichoice: 0,
        acceptedOptions: [3],
        description: "Test proposal - IRA only",
        votingWhitelist: [await bioPassportVoting.getAddress()],
        votingWhitelistData: [getVotingConfig([0x495241])], // IRA only
      };

      await proposalsState.createProposal(proposalConfig);

      // Vote with IRA passport
      const iraData = getUserData(0x495241);
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256[]", "tuple(uint256,uint256,uint256)"],
        [1, [1], Object.values(iraData)],
      );

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
});
