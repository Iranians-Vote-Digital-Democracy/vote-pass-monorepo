import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { ProposalsState__factory, VotingVerifier__factory, BioPassportVoting__factory } from "@ethers-v6";

import { getConfig } from "./config/config";

/**
 * Deploys BioPassportVoting for TD3 passport document voting.
 *
 * Uses VotingVerifier (Groth16) for TD3 signal verification.
 * BioPassportVoting implements _buildPublicSignals() for TD3 signal construction.
 */
export = async (deployer: Deployer) => {
  const config = (await getConfig())!;

  const proposalsState = await deployer.deployed(ProposalsState__factory);

  const votingVerifier = await deployer.deploy(VotingVerifier__factory);

  const bioPassportVoting = await deployer.deployERC1967Proxy(BioPassportVoting__factory);

  await bioPassportVoting.__BioPassportVoting_init(
    config.registrationSMT,
    await proposalsState.getAddress(),
    await votingVerifier.getAddress(),
  );

  await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

  await Reporter.reportContractsMD(
    ["BioPassportVoting", `${await bioPassportVoting.getAddress()}`],
    ["VotingVerifier", `${await votingVerifier.getAddress()}`],
    ["ProposalsState", `${await proposalsState.getAddress()}`],
  );
};
