/**
 * Seed local Hardhat node with test proposals.
 *
 * Usage:
 *   npx hardhat run scripts/seed-local.ts --network localhost
 *
 * Prerequisites:
 *   1. Hardhat node running: npx hardhat node
 *   2. Contracts deployed: npx hardhat migrate --network localhost
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding proposals with account:", deployer.address);

  // Find the ProposalsState contract — deployed via migration
  // Read the deployed address from the migration artifacts
  const ProposalsState = await ethers.getContractFactory("ProposalsState", {
    libraries: {
      PoseidonUnit3L: await findLibraryAddress("PoseidonUnit3L"),
    },
  });

  // The ProposalsState is behind a proxy. Get its address from deployment.
  const proposalsStateAddress = await getDeployedAddress("ProposalsState");
  const proposalsState = ProposalsState.attach(proposalsStateAddress) as any;

  // Find BioPassportVoting address
  const bioPassportVotingAddress = await getDeployedAddress("BioPassportVoting");

  console.log(`ProposalsState: ${proposalsStateAddress}`);
  console.log(`BioPassportVoting: ${bioPassportVotingAddress}`);

  const now = Math.floor(Date.now() / 1000);

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
  const proposal1Config = {
    startTimestamp: now - 60, // started 1 minute ago
    duration: 30 * 24 * 60 * 60, // 30 days
    multichoice: 0,
    acceptedOptions: [3, 7, 15], // 3 options
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
    acceptedOptions: [3, 7], // 2 options
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
    acceptedOptions: [3, 7], // 2 options
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
 * Find a deployed contract address from the migration artifacts.
 * Falls back to scanning recent deployment events.
 */
async function getDeployedAddress(contractName: string): Promise<string> {
  // Try reading from @solarity/hardhat-migrate artifacts
  const fs = await import("fs");
  const path = await import("path");

  const artifactDir = path.join(__dirname, "..", "deployed", "localhost");
  if (fs.existsSync(artifactDir)) {
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.includes(contractName)) {
        const data = JSON.parse(fs.readFileSync(path.join(artifactDir, file), "utf-8"));
        if (data.address) return data.address;
      }
    }
  }

  // Fallback: scan the contract report markdown
  const reportPath = path.join(__dirname, "..", "deployed", "localhost.md");
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, "utf-8");
    const regex = new RegExp(`\\|\\s*${contractName}\\s*\\|\\s*(0x[0-9a-fA-F]+)\\s*\\|`);
    const match = report.match(regex);
    if (match) return match[1];
  }

  throw new Error(`Could not find deployed address for ${contractName}. Run 'npx hardhat migrate --network localhost' first.`);
}

/**
 * Find the deployed PoseidonUnit library address.
 */
async function findLibraryAddress(libName: string): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");

  const artifactDir = path.join(__dirname, "..", "deployed", "localhost");
  if (fs.existsSync(artifactDir)) {
    const files = fs.readdirSync(artifactDir);
    for (const file of files) {
      if (file.includes(libName) || file.includes("Poseidon")) {
        const data = JSON.parse(fs.readFileSync(path.join(artifactDir, file), "utf-8"));
        if (data.address) return data.address;
      }
    }
  }

  // Fallback: search report
  const reportPath = path.join(__dirname, "..", "deployed", "localhost.md");
  if (fs.existsSync(reportPath)) {
    const report = fs.readFileSync(reportPath, "utf-8");
    const regex = new RegExp(`\\|\\s*${libName}\\s*\\|\\s*(0x[0-9a-fA-F]+)\\s*\\|`);
    const match = report.match(regex);
    if (match) return match[1];
  }

  throw new Error(`Could not find deployed address for library ${libName}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
