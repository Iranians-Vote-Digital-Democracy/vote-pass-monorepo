//
//  VoteSubmissionService.swift
//  IranUnchained
//
//  Orchestrates the full vote submission flow — direct port of Android's VoteSubmissionService.kt.
//
//  Steps:
//    0: Build proof inputs (fetch SMT root, proposalEventId, encode date/votes)
//    1: Generate ZK proof (or mock proof for local dev)
//    2: Encode calldata + submit (direct-to-chain for local dev, relayer for production)
//    3: Confirmed
//

import Foundation
import OSLog

class VoteSubmissionService {
    private let config: Config
    private let user: User?
    private let logger = Logger(subsystem: "org.IranUnchained", category: "VoteSubmission")

    init(config: Config, user: User?) {
        self.config = config
        self.user = user
    }

    func submitVote(
        proposal: ProposalData,
        selectedOptions: [Int],
        onProgress: @escaping (Int) -> Void
    ) async throws {
        // Step 0: Build proof inputs
        onProgress(0)
        logger.info("Vote submission: selectedOptions=\(selectedOptions) (0-indexed)")
        let proofInputs = try await buildProofInputs(proposal: proposal, selectedOptions: selectedOptions)

        // Step 1: Generate ZK proof
        onProgress(1)
        let proof: ZKProofPoints
        if config.isLocalDev {
            logger.info("Mock proofs enabled: generating random proof (VerifierMock accepts any proof)")
            proof = ZKProofPoints.mock()
        } else {
            // TODO: Integrate real Groth16 proof generation via ZKUtils
            throw "Real ZK proof generation not yet implemented on iOS. Use local dev build."
        }

        // Step 2: Submit vote
        onProgress(2)
        let txHash = try await submitToChain(
            proposal: proposal,
            proofInputs: proofInputs,
            proof: proof
        )
        logger.info("Vote submitted, tx: \(txHash)")

        // Step 3: Confirmed
        onProgress(3)
    }

    // MARK: - Build Proof Inputs

    private struct ProofInputs {
        let registrationRoot: String      // 64-char hex (no 0x)
        let currentDate: String           // hex-encoded ASCII date
        let proposalEventId: String       // 64-char hex
        let nullifier: String             // hex
        let citizenship: String           // hex
        let identityCreationTimestamp: String // hex
        let votes: [UInt64]
        let inputsJSON: String            // circuit inputs
    }

    private func buildProofInputs(
        proposal: ProposalData,
        selectedOptions: [Int]
    ) async throws -> ProofInputs {
        guard let user = user else {
            throw "Identity not found. Please scan your passport first."
        }

        let rpcURL = config.rarimo.targetChainRPCURL

        // Get proposal event ID
        let proposalEventIdHex = try await ProposalProvider.getProposalEventId(
            rpcURL: rpcURL,
            contractAddress: config.freedom.proposalsStateAddress,
            proposalId: proposal.proposalId
        )

        // Get registration SMT root
        let registrationRoot = try await ProposalProvider.getRegistrationRoot(
            rpcURL: rpcURL,
            contractAddress: config.freedom.registrationContractAddress
        )

        // Encode current date as ASCII bytes
        let cal = Calendar.current
        let now = Date()
        let currentDate = CalldataEncoder.encodeDateAsAsciiBytes(
            year: cal.component(.year, from: now),
            month: cal.component(.month, from: now),
            day: cal.component(.day, from: now)
        )

        // Encode votes
        let votes = CalldataEncoder.encodeVoteBitmasks(selectedOptions: selectedOptions, totalOptions: proposal.options.count)
        logger.info("Vote bitmask: \(votes[0]) (binary: \(String(votes[0], radix: 2)))")

        // Identity fields
        let nullifierHex = hexFromSecretKey(user.secretKey)
        let citizenshipHex = citizenshipToHex(user.issuingAuthority)
        let timestampHex = String(user.creationTimestamp, radix: 16)

        // Circuit inputs (Semaphore-style)
        let voteValue = votes.first ?? 0
        let pathElements = [String](repeating: "0", count: 20)
        let pathIndices = [String](repeating: "0", count: 20)

        let inputsJSON = VoteSMTInputsBuilder.buildJSON(
            root: registrationRoot,
            nullifierHash: nullifierHex, // Phase 1: nullifierHash = nullifier
            nullifier: nullifierHex,
            vote: String(voteValue),
            secret: nullifierHex,
            pathElements: pathElements,
            pathIndices: pathIndices
        )

        return ProofInputs(
            registrationRoot: registrationRoot,
            currentDate: currentDate,
            proposalEventId: proposalEventIdHex,
            nullifier: nullifierHex,
            citizenship: citizenshipHex,
            identityCreationTimestamp: timestampHex,
            votes: votes,
            inputsJSON: inputsJSON
        )
    }

    // MARK: - Submit

    private func submitToChain(
        proposal: ProposalData,
        proofInputs: ProofInputs,
        proof: ZKProofPoints
    ) async throws -> String {
        // Encode userPayload
        let userPayload = CalldataEncoder.encodeUserPayload(
            proposalId: UInt64(proposal.proposalId),
            votes: proofInputs.votes,
            nullifier: proofInputs.nullifier,
            citizenship: proofInputs.citizenship,
            identityCreationTimestamp: proofInputs.identityCreationTimestamp
        )

        // Encode full calldata
        let calldata = CalldataEncoder.encodeExecuteCalldata(
            registrationRoot: proofInputs.registrationRoot,
            currentDate: proofInputs.currentDate,
            userPayload: userPayload,
            proof: proof
        )

        if config.isLocalDev {
            return try await submitDirectToChain(
                votingContractAddress: proposal.votingContractAddress,
                calldata: calldata
            )
        } else {
            return try await submitToRelayer(
                votingContractAddress: proposal.votingContractAddress,
                calldata: calldata
            )
        }
    }

    /// Submit directly to local Hardhat chain using account #0.
    private func submitDirectToChain(
        votingContractAddress: String,
        calldata: String
    ) async throws -> String {
        logger.info("Local dev: submitting tx directly to chain")
        let rpc = RawRPCClient(rpcURL: config.rarimo.targetChainRPCURL)

        // Use Hardhat account #0 via eth_sendTransaction (Hardhat auto-signs for known accounts)
        let hardhatAccount0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

        let txParams: [String: Any] = [
            "from": hardhatAccount0,
            "to": votingContractAddress,
            "data": calldata,
            "gas": "0x1e8480" // 2,000,000
        ]

        let txHash = try await rpc.sendTransaction(params: txParams)
        logger.info("Local dev: tx hash = \(txHash)")
        return txHash
    }

    /// Submit to the proof-verification-relayer for production.
    private func submitToRelayer(
        votingContractAddress: String,
        calldata: String
    ) async throws -> String {
        let relayerURL = config.freedom.proofVerificationRelayerURL
        var requestURL = relayerURL
        requestURL.append(path: "/integrations/proof-verification-relayer/v1/vote")

        let body: [String: Any] = [
            "data": [
                "tx_data": calldata,
                "destination": votingContractAddress
            ]
        ]

        var request = URLRequest(url: requestURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
            let responseBody = String(data: data, encoding: .utf8) ?? ""
            throw "Relayer error (HTTP \(httpResponse.statusCode)): \(responseBody)"
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let dataObj = json["data"] as? [String: Any],
              let txHash = dataObj["id"] as? String
        else {
            throw "Invalid relayer response"
        }

        return txHash
    }

    // MARK: - Helpers

    /// Derive a hex nullifier from the user's secret key.
    /// For local dev, just use the first 32 bytes of the key as hex.
    private func hexFromSecretKey(_ secretKey: String) -> String {
        // secretKey is the BJJ secret key string from Go Identity lib
        // Convert to hex representation for use in circuit inputs
        let bytes = Array(secretKey.utf8)
        if bytes.count >= 32 {
            return bytes.prefix(32).map { String(format: "%02x", $0) }.joined()
        }
        // If shorter, pad with zeros
        return bytes.map { String(format: "%02x", $0) }.joined()
            + String(repeating: "00", count: max(0, 32 - bytes.count))
    }

    /// Convert 3-letter country code to hex (same as Android's getCitizenshipCode).
    private func citizenshipToHex(_ issuingAuthority: String) -> String {
        let bytes = Array(issuingAuthority.utf8)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
}
