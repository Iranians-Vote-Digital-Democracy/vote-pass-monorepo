//
//  ProposalProvider.swift
//  IranUnchained
//
//  Fetches proposals from ProposalsState contract via raw eth_call + manual ABI hex parsing.
//  Direct port of Android's ProposalProvider.kt.
//

import Foundation
import OSLog

enum ProposalProvider {
    private static let logger = Logger(subsystem: "org.IranUnchained", category: "ProposalProvider")

    // Function selectors (keccak256 of canonical signatures)
    private static let lastProposalIdSelector = "0x0e6c0b76"
    // getProposalInfo(uint256) = keccak("getProposalInfo(uint256)") first 4 bytes
    private static let getProposalInfoSelector = "0xbc096bdd"
    // getProposalEventId(uint256)
    private static let getProposalEventIdSelector = "0x9fa6be3a"
    // getRoot() on Registration2/PoseidonSMT
    private static let getRootSelector = "0x5ca1e165"

    /// Fetch all proposals, split into active and ended lists.
    static func getProposals(rpcURL: URL, contractAddress: String) async throws -> (active: [ProposalData], ended: [ProposalData]) {
        let rpc = RawRPCClient(rpcURL: rpcURL)

        // Get last proposal ID
        let lastIdHex = try await rpc.ethCall(to: contractAddress, data: lastProposalIdSelector)
        let lastId = hexToInt64(lastIdHex)
        logger.info("Last proposal ID: \(lastId)")

        var activeList: [ProposalData] = []
        var endedList: [ProposalData] = []

        for id in 1...max(lastId, 1) {
            if lastId == 0 { break }
            do {
                let info = try await fetchProposalInfo(rpc: rpc, contractAddress: contractAddress, proposalId: id)
                let status = ProposalStatus.fromValue(info.status)

                if status == .none || status == .doNotShow {
                    continue
                }

                let metadata = ProposalParser.parseDescription(info.description)

                let options: [ProposalOption]
                if !metadata.options.isEmpty {
                    options = metadata.options.enumerated().map { ProposalOption(id: $0.offset, name: $0.element) }
                } else {
                    options = info.acceptedOptions.enumerated().map { ProposalOption(id: $0.offset, name: "Option \($0.offset + 1)") }
                }

                let votingContractAddress = info.votingWhitelist.first ?? ""
                let citizenshipWhitelist = ProposalParser.parseVotingWhitelistData(info.votingWhitelistData)

                let proposal = ProposalData(
                    proposalId: id,
                    title: metadata.title,
                    description: metadata.description,
                    options: options,
                    startTimestamp: info.startTimestamp,
                    endTimestamp: info.startTimestamp + info.duration,
                    status: status,
                    votingResults: info.votingResults,
                    multichoice: info.multichoice,
                    votingContractAddress: votingContractAddress,
                    proposalSMTAddress: info.proposalSMT,
                    citizenshipWhitelist: citizenshipWhitelist
                )

                switch status {
                case .started:
                    activeList.append(proposal)
                case .ended, .waiting:
                    endedList.append(proposal)
                default:
                    break
                }
            } catch {
                logger.error("Failed to load proposal \(id): \(error)")
            }
        }

        activeList.sort { $0.startTimestamp < $1.startTimestamp }
        endedList.sort { $0.startTimestamp < $1.startTimestamp }

        return (active: activeList, ended: endedList)
    }

    /// Re-fetch voting results for a single proposal.
    static func getVotingResults(rpcURL: URL, contractAddress: String, proposalId: Int64) async throws -> [[Int64]] {
        let rpc = RawRPCClient(rpcURL: rpcURL)
        let info = try await fetchProposalInfo(rpc: rpc, contractAddress: contractAddress, proposalId: proposalId)
        return info.votingResults
    }

    /// Get proposal event ID (used for nullifier computation).
    static func getProposalEventId(rpcURL: URL, contractAddress: String, proposalId: Int64) async throws -> String {
        let rpc = RawRPCClient(rpcURL: rpcURL)
        let data = getProposalEventIdSelector + padLeft(String(proposalId, radix: 16), totalChars: 64)
        let hex = try await rpc.ethCall(to: contractAddress, data: data)
        return hex
    }

    /// Get SMT root from registration contract.
    static func getRegistrationRoot(rpcURL: URL, contractAddress: String) async throws -> String {
        let rpc = RawRPCClient(rpcURL: rpcURL)
        let hex = try await rpc.ethCall(to: contractAddress, data: getRootSelector)
        return hex
    }

    // MARK: - Private

    private static func fetchProposalInfo(rpc: RawRPCClient, contractAddress: String, proposalId: Int64) async throws -> DecodedProposalInfo {
        let data = getProposalInfoSelector + padLeft(String(proposalId, radix: 16), totalChars: 64)
        let hex = try await rpc.ethCall(to: contractAddress, data: data)
        return parseProposalInfoHex(hex)
    }

    /// Parse ABI-encoded ProposalInfo struct from raw hex.
    ///
    /// Layout (ProposalInfo is returned as a single tuple):
    ///   word 0: offset to struct (0x20)
    ///   struct:
    ///     +0x00: proposalSMT (address)
    ///     +0x20: status (uint8)
    ///     +0x40: offset to ProposalConfig (relative to struct start)
    ///     +0x60: offset to votingResults (relative to struct start)
    ///   ProposalConfig (at struct + configOffset):
    ///     +0x00: startTimestamp (uint64)
    ///     +0x20: duration (uint64)
    ///     +0x40: multichoice (uint256)
    ///     +0x60: offset to acceptedOptions (relative to config start)
    ///     +0x80: offset to description (relative to config start)
    ///     +0xa0: offset to votingWhitelist (relative to config start)
    ///     +0xc0: offset to votingWhitelistData (relative to config start)
    private static func parseProposalInfoHex(_ hex: String) -> DecodedProposalInfo {
        // word 0: offset to struct data
        let structOffset = Int(readUint(hex, charOffset: 0))
        let s = structOffset * 2 // char offset

        // ProposalInfo fields
        let proposalSMT = "0x" + substring(hex, from: s + 24, length: 40)
        let status = Int(readUint(hex, charOffset: s + 64))
        let configOffset = Int(readUint(hex, charOffset: s + 128))
        let votingResultsOffset = Int(readUint(hex, charOffset: s + 192))

        // ProposalConfig at struct + configOffset
        let c = s + configOffset * 2
        let startTimestamp = Int64(readUint(hex, charOffset: c))
        let duration = Int64(readUint(hex, charOffset: c + 64))
        let multichoice = Int64(readUint(hex, charOffset: c + 128))
        let acceptedOptionsOffset = Int(readUint(hex, charOffset: c + 192))
        let descriptionOffset = Int(readUint(hex, charOffset: c + 256))
        let votingWhitelistOffset = Int(readUint(hex, charOffset: c + 320))
        let votingWhitelistDataOffset = Int(readUint(hex, charOffset: c + 384))

        // Parse acceptedOptions: uint256[]
        let aoBase = c + acceptedOptionsOffset * 2
        let aoLen = Int(readUint(hex, charOffset: aoBase))
        var acceptedOptions: [UInt64] = []
        for i in 0..<aoLen {
            acceptedOptions.append(readUint(hex, charOffset: aoBase + 64 + i * 64))
        }

        // Parse description: string (bytes)
        let descBase = c + descriptionOffset * 2
        let descLen = Int(readUint(hex, charOffset: descBase))
        let descBytes = hexToBytes(substring(hex, from: descBase + 64, length: descLen * 2))
        let description = String(data: Data(descBytes), encoding: .utf8) ?? ""

        // Parse votingWhitelist: address[]
        let vwBase = c + votingWhitelistOffset * 2
        let vwLen = Int(readUint(hex, charOffset: vwBase))
        var votingWhitelist: [String] = []
        for i in 0..<vwLen {
            let wordStart = vwBase + 64 + i * 64
            votingWhitelist.append("0x" + substring(hex, from: wordStart + 24, length: 40))
        }

        // Parse votingWhitelistData: bytes[]
        let vwdBase = c + votingWhitelistDataOffset * 2
        let vwdLen = Int(readUint(hex, charOffset: vwdBase))
        var votingWhitelistData: [Data] = []
        for i in 0..<vwdLen {
            let elementOffset = Int(readUint(hex, charOffset: vwdBase + 64 + i * 64))
            let elemBase = vwdBase + 64 + elementOffset * 2
            let elemLen = Int(readUint(hex, charOffset: elemBase))
            let bytes = hexToBytes(substring(hex, from: elemBase + 64, length: elemLen * 2))
            votingWhitelistData.append(Data(bytes))
        }

        // Parse votingResults: uint256[8][] (dynamic array of static arrays of 8)
        let vrBase = s + votingResultsOffset * 2
        let vrLen = Int(readUint(hex, charOffset: vrBase))
        var votingResults: [[Int64]] = []
        for i in 0..<vrLen {
            let elemStart = vrBase + 64 + i * 8 * 64
            var row: [Int64] = []
            for j in 0..<8 {
                row.append(Int64(readUint(hex, charOffset: elemStart + j * 64)))
            }
            votingResults.append(row)
        }

        return DecodedProposalInfo(
            proposalSMT: proposalSMT,
            status: status,
            startTimestamp: startTimestamp,
            duration: duration,
            multichoice: multichoice,
            acceptedOptions: acceptedOptions,
            description: description,
            votingWhitelist: votingWhitelist,
            votingWhitelistData: votingWhitelistData,
            votingResults: votingResults
        )
    }

    /// Read a 256-bit unsigned integer from hex at the given character offset.
    /// Returns as UInt64 (sufficient for the values we need).
    private static func readUint(_ hex: String, charOffset: Int) -> UInt64 {
        let str = substring(hex, from: charOffset, length: 64)
        // For large values, just take the last 16 hex chars (8 bytes)
        // For addresses and offsets this is sufficient
        if str.count > 16 {
            let suffix = String(str.suffix(16))
            return UInt64(suffix, radix: 16) ?? 0
        }
        return UInt64(str, radix: 16) ?? 0
    }

    /// Read a full 256-bit value as hex string (for roots, hashes, etc.)
    private static func readUint256Hex(_ hex: String, charOffset: Int) -> String {
        return substring(hex, from: charOffset, length: 64)
    }

    private static func substring(_ str: String, from: Int, length: Int) -> String {
        guard from >= 0, from + length <= str.count else { return "" }
        let startIndex = str.index(str.startIndex, offsetBy: from)
        let endIndex = str.index(startIndex, offsetBy: length)
        return String(str[startIndex..<endIndex])
    }

    private static func hexToBytes(_ hex: String) -> [UInt8] {
        var bytes: [UInt8] = []
        var i = hex.startIndex
        while i < hex.endIndex {
            let nextIndex = hex.index(i, offsetBy: 2, limitedBy: hex.endIndex) ?? hex.endIndex
            if let byte = UInt8(hex[i..<nextIndex], radix: 16) {
                bytes.append(byte)
            }
            i = nextIndex
        }
        return bytes
    }

    private static func hexToInt64(_ hex: String) -> Int64 {
        let cleaned = hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
        // Take last 16 chars for UInt64
        let suffix = cleaned.count > 16 ? String(cleaned.suffix(16)) : cleaned
        return Int64(UInt64(suffix, radix: 16) ?? 0)
    }

    private static func padLeft(_ hex: String, totalChars: Int) -> String {
        let str = hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
        if str.count >= totalChars { return str }
        return String(repeating: "0", count: totalChars - str.count) + str
    }
}

private struct DecodedProposalInfo {
    let proposalSMT: String
    let status: Int
    let startTimestamp: Int64
    let duration: Int64
    let multichoice: Int64
    let acceptedOptions: [UInt64]
    let description: String
    let votingWhitelist: [String]
    let votingWhitelistData: [Data]
    let votingResults: [[Int64]]
}
