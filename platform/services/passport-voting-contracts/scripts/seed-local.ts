/**
 * Seed local Hardhat node with test proposals.
 *
 * Usage:
 *   npx hardhat run scripts/seed-local.ts --network localhost
 *
 * Prerequisites:
 *   1. Hardhat node running: npx hardhat node
 *   2. Contracts deployed: npx hardhat migrate --network localhost
 *
 * Address discovery: scans all deployed contracts to find ProposalsState
 * by checking if they respond to lastProposalId(). No artifact files needed.
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding proposals with account:", deployer.address);

  // Discover ProposalsState and BioPassportVoting by probing deployed contracts
  const { proposalsStateAddress, bioPassportVotingAddress } = await discoverContracts();

  // Attach using compiled ABI (ethers.getContractAt loads from artifacts)
  const proposalsState = await ethers.getContractAt("ProposalsState", proposalsStateAddress);

  console.log(`ProposalsState: ${proposalsStateAddress}`);
  console.log(`BioPassportVoting: ${bioPassportVotingAddress}`);

  // Advance Hardhat node time to present (node starts at initialDate: "2004-01-01")
  const realNow = Math.floor(Date.now() / 1000);
  const latestBlockForTime = await ethers.provider.getBlock("latest");
  const chainTime = latestBlockForTime!.timestamp;
  if (chainTime < realNow - 3600) {
    console.log(`\nAdvancing chain time from ${new Date(chainTime * 1000).toISOString()} to present...`);
    await ethers.provider.send("evm_setNextBlockTimestamp", [realNow]);
    await ethers.provider.send("evm_mine", []);
    console.log(`  Chain time now: ${new Date(realNow * 1000).toISOString()}`);
  }

  const now = realNow;

  // Helper to encode voting config (ProposalRules struct)
  function encodeVotingConfig(citizenshipWhitelist: number[] = []) {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    return coder.encode(
      ["tuple(uint256,uint256[],uint256,uint256,uint256,uint256,uint256,uint256)"],
      [
        [
          0x00, // selector
          citizenshipWhitelist, // empty = all countries accepted
          1821401330, // identityCreationTimestampUpperBound (far future)
          1, // identityCounterUpperBound
          0x00, // sex (any)
          0x303030303030, // birthDateLowerbound (000000)
          0x393930373139, // birthDateUpperbound (far future)
          0x303030303030, // expirationDateLowerBound (000000)
        ],
      ],
    );
  }

  // Helper to build description JSON that ProposalProvider.parseDescription() can parse
  function makeDescription(title: string, description: string, options: string[]) {
    return JSON.stringify({ title, description, options });
  }

  // ── Proposal 1: Active, multi-option ──────────────────────────────────
  // acceptedOptions is per-question-group, NOT per-display-option.
  // For a single question with N choices: [(1 << N) - 1]
  // Vote is [1 << selectedOptionIndex] (power of 2 within the bitmask).
  const proposal1Config = {
    startTimestamp: now - 60, // started 1 minute ago
    duration: 30 * 24 * 60 * 60, // 30 days
    multichoice: 0,
    acceptedOptions: [7], // 1 question group, 3 choices (7 = 0b111)
    description: makeDescription(
      "Community Budget Allocation",
      "Vote on how to allocate the community budget for the next quarter. Choose the area that should receive the most funding.",
      ["Parks & Recreation", "Education", "Infrastructure"],
    ),
    votingWhitelist: [bioPassportVotingAddress],
    votingWhitelistData: [encodeVotingConfig([])], // all countries
  };

  // ── Proposal 2: Active, yes/no ────────────────────────────────────────
  const proposal2Config = {
    startTimestamp: now - 120, // started 2 minutes ago
    duration: 7 * 24 * 60 * 60, // 7 days
    multichoice: 0,
    acceptedOptions: [3], // 1 question group, 2 choices (3 = 0b11)
    description: makeDescription(
      "Platform Governance Vote",
      "Should the platform implement mandatory two-factor authentication for all users?",
      ["Yes", "No"],
    ),
    votingWhitelist: [bioPassportVotingAddress],
    votingWhitelistData: [encodeVotingConfig([])], // all countries
  };

  // ── Proposal 3: Ended ─────────────────────────────────────────────────
  const proposal3Config = {
    startTimestamp: now - 90 * 24 * 60 * 60, // started 90 days ago
    duration: 30 * 24 * 60 * 60, // lasted 30 days (ended 60 days ago)
    multichoice: 0,
    acceptedOptions: [3], // 1 question group, 2 choices (3 = 0b11)
    description: makeDescription(
      "Previous Quarter Review",
      "Do you approve the community treasury report for the previous quarter?",
      ["Approve", "Reject"],
    ),
    votingWhitelist: [bioPassportVotingAddress],
    votingWhitelistData: [encodeVotingConfig([])], // all countries
  };

  // Create proposals
  console.log("\nCreating proposal 1: Community Budget Allocation...");
  let tx = await proposalsState.createProposal(proposal1Config);
  await tx.wait();
  console.log("  Created (tx:", tx.hash, ")");

  console.log("Creating proposal 2: Platform Governance Vote...");
  tx = await proposalsState.createProposal(proposal2Config);
  await tx.wait();
  console.log("  Created (tx:", tx.hash, ")");

  console.log("Creating proposal 3: Previous Quarter Review (ended)...");
  tx = await proposalsState.createProposal(proposal3Config);
  await tx.wait();
  console.log("  Created (tx:", tx.hash, ")");

  // Verify
  const lastId = await proposalsState.lastProposalId();
  console.log(`\nTotal proposals: ${lastId}`);

  for (let i = 1; i <= Number(lastId); i++) {
    const info = await proposalsState.getProposalInfo(i);
    const config = info.config;
    const desc = JSON.parse(config.description);
    console.log(`  #${i}: "${desc.title}" — status=${info.status}, options=${desc.options.length}`);
  }

  console.log("\nSeeding complete!");
}

/**
 * Discover deployed contracts by scanning recent transactions.
 * Uses eth_getCode to find contracts and probes them with known selectors.
 */
async function discoverContracts() {
  const provider = ethers.provider;

  // Get the latest block number to scan deployed contracts
  const latestBlock = await provider.getBlockNumber();

  // Collect all unique contract addresses from transaction receipts
  const contractAddresses: string[] = [];
  for (let i = 1; i <= latestBlock; i++) {
    const block = await provider.getBlock(i, true);
    if (!block || !block.transactions) continue;
    for (const txHash of block.transactions) {
      const receipt = await provider.getTransactionReceipt(txHash as string);
      if (receipt && receipt.contractAddress) {
        contractAddresses.push(receipt.contractAddress);
      }
    }
  }

  console.log(`Found ${contractAddresses.length} deployed contracts, probing...`);

  // Find ALL contracts that respond to lastProposalId() (both implementation and proxy)
  const proposalsStateAbi = [
    "function lastProposalId() view returns (uint256)",
    "function getProposalInfo(uint256) view returns (tuple(uint8 status, tuple(uint256 startTimestamp, uint256 duration, uint256 multichoice, uint256[] acceptedOptions, string description, address[] votingWhitelist, bytes[] votingWhitelistData) config, tuple(uint256 proposalSMT) proposalSMT, uint256[][] votingResults))",
    "function createProposal(tuple(uint256 startTimestamp, uint256 duration, uint256 multichoice, uint256[] acceptedOptions, string description, address[] votingWhitelist, bytes[] votingWhitelistData))",
  ];

  const proposalsStateCandidates: string[] = [];
  for (const addr of contractAddresses) {
    try {
      const contract = new ethers.Contract(addr, proposalsStateAbi, (await ethers.getSigners())[0]);
      await contract.lastProposalId();
      proposalsStateCandidates.push(addr);
      console.log(`  ProposalsState candidate: ${addr}`);
    } catch {
      // Not ProposalsState, continue
    }
  }

  if (proposalsStateCandidates.length === 0) {
    throw new Error("Could not find ProposalsState contract. Run 'npx hardhat migrate --network localhost' first.");
  }

  // Find BioPassportVoting by matching proposalsState() to any candidate
  let bioPassportVotingAddress = "";
  let matchedProposalsStateAddress = "";
  const votingAbi = ["function proposalsState() view returns (address)"];

  for (const addr of contractAddresses) {
    try {
      const contract = new ethers.Contract(addr, votingAbi, provider);
      const psAddr = await contract.proposalsState();
      const psAddrLower = psAddr.toLowerCase();
      if (proposalsStateCandidates.some(c => c.toLowerCase() === psAddrLower)) {
        bioPassportVotingAddress = addr;
        matchedProposalsStateAddress = psAddr;
        console.log(`  BioPassportVoting found at: ${addr}`);
        console.log(`  Matched ProposalsState at: ${psAddr}`);
        break;
      }
    } catch {
      // Not BioPassportVoting, continue
    }
  }

  if (!bioPassportVotingAddress) {
    throw new Error("Could not find BioPassportVoting contract.");
  }

  return { proposalsStateAddress: matchedProposalsStateAddress, bioPassportVotingAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
