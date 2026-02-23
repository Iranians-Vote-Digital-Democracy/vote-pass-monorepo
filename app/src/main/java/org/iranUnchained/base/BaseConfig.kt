package org.iranUnchained.base

import org.iranUnchained.BuildConfig


// Production (Rarimo L2 Mainnet)
object BaseConfig {
    const val CREATE_IDENTITY_LINK =
        "https:///kyc.iran.freedomtool.org/integrations/identity-provider-service/v1/create-identity"

    const val GIST_DATA_LINK =
        "https:///kyc.iran.freedomtool.org/integrations/identity-provider-service/v1/gist-data"

    const val CLAIM_OFFER_LINK_V2 = "https://issuer.iran.freedomtool.org/v1/offer/{claim_id}"

    const val SEND_REGISTRATION_LINK =
        "https://proofverification.iran.freedomtool.org/integrations/proof-verification-relayer/v1/register"

    const val VOTE_LINK =
        "https://proofverification.iran.freedomtool.org/integrations/proof-verification-relayer/v2/vote"

    const val REGISTRATION_ADDRESS = "0x90D6905362a9CBaF3A401a629a19057D23055Baf"
    const val PROPOSAL_ADDRESS = "0xB1e1650A95e2baC47084D3E324766d3B16e5d0ef"
    const val CORE_LINK = "https://rpc-api.mainnet.rarimo.com"

    const val BLOCK_CHAIN_RPC_LINK = "https://rpcproxy.iran.freedomtool.org"

    const val REGISTRATION_TYPE = "Simple Registration"

    const val PRIVACY_POLICY_URL = "https://www.iranians.vote/privacy-policy.html"
}

// Rarimo L2 Testnet
object TestNet {

    const val CREATE_IDENTITY_LINK =
        "https://api.stage.freedomtool.org/integrations/identity-provider-service/v1/create-identity"
    const val GIST_DATA_LINK =
        "https://api.stage.freedomtool.org/integrations/identity-provider-service/v1/gist-data"
    const val SEND_REGISTRATION_LINK =
        "https://api.stage.freedomtool.org/integrations/proof-verification-relayer/v1/register"

    const val VOTE_LINK =
        "https://api.stage.freedomtool.org/integrations/proof-verification-relayer/v2/vote"

    const val CLAIM_OFFER_LINK_V2 =
        "https://issuer.polygon.robotornot.mainnet-beta.rarimo.com/v1/offer/{claim_id}"

    const val CORE_LINK = "https://rpc-api.node1.mainnet-beta.rarimo.com"
    const val REGISTRATION_ADDRESS = "0xC97c08F18F03bF14c7013533A53fbCe934E5Cb1e"
    const val PROPOSAL_ADDRESS = "0xb6407f0bb10fDC61863253e0ca36531Fc6D4aedE"

    const val BLOCK_CHAIN_RPC_LINK = "https://rpc.qtestnet.org"

    const val REGISTRATION_TYPE = "Simple Registration"

    const val PRIVACY_POLICY_URL = "https://www.iranians.vote/privacy-policy.html"
}

// Local Development (Docker platform services)
// Use 10.0.2.2 for Android emulator -> host machine, or your machine's IP for device
object LocalDev {
    private const val GATEWAY = "http://10.0.2.2:8000"

    const val CREATE_IDENTITY_LINK =
        "$GATEWAY/integrations/identity-provider-service/v1/create-identity"
    const val GIST_DATA_LINK =
        "$GATEWAY/integrations/identity-provider-service/v1/gist-data"
    const val CLAIM_OFFER_LINK_V2 = "http://10.0.2.2:3002/v1/offer/{claim_id}"

    const val SEND_REGISTRATION_LINK =
        "$GATEWAY/integrations/registration-relayer/v1/register"
    const val VOTE_LINK =
        "$GATEWAY/integrations/proof-verification-relayer/v2/vote"
    const val PROPOSALS_LINK =
        "$GATEWAY/integrations/proof-verification-relayer/v2/proposals"
    const val AUTH_LINK =
        "$GATEWAY/integrations/decentralized-auth-svc/v1/authorize"

    const val CORE_LINK = "http://10.0.2.2:8545"

    // Contracts deployed on local Hardhat (update after deploy)
    const val REGISTRATION_ADDRESS = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1"
    const val PROPOSAL_ADDRESS = "0x6212cb549De37c25071cF506aB7E115D140D9e42"

    const val BLOCK_CHAIN_RPC_LINK = "http://10.0.2.2:8545"

    const val REGISTRATION_TYPE = "Simple Registration"

    const val PRIVACY_POLICY_URL = "https://www.iranians.vote/privacy-policy.html"
}

/**
 * Runtime config selector — switches between production and local dev
 * based on the IS_LOCAL_DEV build flavor flag.
 */
object ActiveConfig {
    private val isLocal = BuildConfig.IS_LOCAL_DEV

    val CREATE_IDENTITY_LINK: String
        get() = if (isLocal) LocalDev.CREATE_IDENTITY_LINK else BaseConfig.CREATE_IDENTITY_LINK
    val GIST_DATA_LINK: String
        get() = if (isLocal) LocalDev.GIST_DATA_LINK else BaseConfig.GIST_DATA_LINK
    val CLAIM_OFFER_LINK_V2: String
        get() = if (isLocal) LocalDev.CLAIM_OFFER_LINK_V2 else BaseConfig.CLAIM_OFFER_LINK_V2
    val SEND_REGISTRATION_LINK: String
        get() = if (isLocal) LocalDev.SEND_REGISTRATION_LINK else BaseConfig.SEND_REGISTRATION_LINK
    val VOTE_LINK: String
        get() = if (isLocal) LocalDev.VOTE_LINK else BaseConfig.VOTE_LINK
    val REGISTRATION_ADDRESS: String
        get() = if (isLocal) LocalDev.REGISTRATION_ADDRESS else BaseConfig.REGISTRATION_ADDRESS
    val PROPOSAL_ADDRESS: String
        get() = if (isLocal) LocalDev.PROPOSAL_ADDRESS else BaseConfig.PROPOSAL_ADDRESS
    val CORE_LINK: String
        get() = if (isLocal) LocalDev.CORE_LINK else BaseConfig.CORE_LINK
    val BLOCK_CHAIN_RPC_LINK: String
        get() = if (isLocal) LocalDev.BLOCK_CHAIN_RPC_LINK else BaseConfig.BLOCK_CHAIN_RPC_LINK
    val REGISTRATION_TYPE: String
        get() = if (isLocal) LocalDev.REGISTRATION_TYPE else BaseConfig.REGISTRATION_TYPE
    val PRIVACY_POLICY_URL: String
        get() = if (isLocal) LocalDev.PRIVACY_POLICY_URL else BaseConfig.PRIVACY_POLICY_URL
}
