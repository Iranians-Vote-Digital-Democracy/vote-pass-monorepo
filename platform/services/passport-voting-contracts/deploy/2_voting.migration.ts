import { Deployer, Reporter } from "@solarity/hardhat-migrate";
import hre from "hardhat";

import { ProposalsState__factory, VotingVerifier__factory, BioPassportVoting__factory } from "@ethers-v6";

import { getConfig } from "./config/config";

/**
 * Deploys BioPassportVoting for TD3 passport document voting.
 *
 * On localhost/hardhat: deploys RegistrationSMTMock + VerifierMock (accepts any proof).
 * On other networks: uses VotingVerifier (Groth16) and external RegistrationSMT.
 */
export = async (deployer: Deployer) => {
  const config = (await getConfig())!;
  const isLocal = hre.network.name === "localhost" || hre.network.name === "hardhat";

  const proposalsState = await deployer.deployed(ProposalsState__factory);

  let verifierAddress: string;
  let registrationSMTAddress: string;

  if (isLocal) {
    // Deploy mock contracts for local testing
    const RegistrationSMTMock = await hre.ethers.getContractFactory("RegistrationSMTMock");
    const registrationSMTMock = await RegistrationSMTMock.deploy();
    registrationSMTAddress = await registrationSMTMock.getAddress();

    const VerifierMock = await hre.ethers.getContractFactory("VerifierMock");
    const verifierMock = await VerifierMock.deploy();
    verifierAddress = await verifierMock.getAddress();

    console.log(`  RegistrationSMTMock deployed at: ${registrationSMTAddress}`);
    console.log(`  VerifierMock deployed at: ${verifierAddress}`);
  } else {
    const votingVerifier = await deployer.deploy(VotingVerifier__factory);
    verifierAddress = await votingVerifier.getAddress();
    registrationSMTAddress = config.registrationSMT;
  }

  const bioPassportVoting = await deployer.deployERC1967Proxy(BioPassportVoting__factory);

  await bioPassportVoting.__BioPassportVoting_init(
    registrationSMTAddress,
    await proposalsState.getAddress(),
    verifierAddress,
  );

  await proposalsState.addVoting("BioPassportVoting", await bioPassportVoting.getAddress());

  await Reporter.reportContractsMD(
    ["BioPassportVoting", `${await bioPassportVoting.getAddress()}`],
    ["Verifier", `${verifierAddress}`],
    ["RegistrationSMT", `${registrationSMTAddress}`],
    ["ProposalsState", `${await proposalsState.getAddress()}`],
  );
};
