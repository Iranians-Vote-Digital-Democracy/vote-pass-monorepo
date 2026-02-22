import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { ProposalsState__factory, NoirTD1Verifier_ID_Card_I__factory, IDCardVoting__factory } from "@ethers-v6";

import { getConfig } from "../config/config";

/**
 * Deploys NoirIDVoting for Iranian National ID (TD1) document voting.
 *
 * IMPORTANT: Uses IDCardVoting (not BioPassportVoting) because:
 * - TD1 documents (ID cards) require executeTD1Noir() method
 * - IDCardVoting implements _buildPublicSignalsTD1() for TD1 signal construction
 * - BioPassportVoting._buildPublicSignalsTD1() reverts with "TD1 voting is not supported"
 */
export = async (deployer: Deployer) => {
  const config = (await getConfig())!;

  const proposalsState = await deployer.deployed(ProposalsState__factory);

  const noirTD1VerifierIDCardI = await deployer.deploy(NoirTD1Verifier_ID_Card_I__factory);

  // Deploy IDCardVoting for TD1 document support
  const noirIDVoting = await deployer.deployERC1967Proxy(IDCardVoting__factory);

  await noirIDVoting.__IDCardVoting_init(
    config.registrationSMT,
    await proposalsState.getAddress(),
    await noirTD1VerifierIDCardI.getAddress(),
  );

  await proposalsState.addVoting("NoirIDVoting", await noirIDVoting.getAddress());

  await Reporter.reportContractsMD(
    ["NoirIDVoting", `${await noirIDVoting.getAddress()}`],
    ["ProposalsState", `${await proposalsState.getAddress()}`],
  );
};
