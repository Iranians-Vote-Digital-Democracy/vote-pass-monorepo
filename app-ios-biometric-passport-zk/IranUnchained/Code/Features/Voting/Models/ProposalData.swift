//
//  ProposalData.swift
//  IranUnchained
//
//  Voting proposal data model — mirrors Android's ProposalData.kt
//

import Foundation

enum ProposalStatus: Int {
    case none = 0
    case waiting = 1
    case started = 2
    case ended = 3
    case doNotShow = 4

    static func fromValue(_ value: Int) -> ProposalStatus {
        return ProposalStatus(rawValue: value) ?? .none
    }
}

struct ProposalOption: Identifiable {
    let id: Int
    let name: String
}

struct ProposalData: Identifiable {
    var id: Int64 { proposalId }

    let proposalId: Int64
    let title: String
    let description: String
    let options: [ProposalOption]
    let startTimestamp: Int64
    let endTimestamp: Int64
    let status: ProposalStatus
    var votingResults: [[Int64]]
    let multichoice: Int64
    let votingContractAddress: String
    let proposalSMTAddress: String
    let citizenshipWhitelist: [Int64]

    var isActive: Bool { status == .started }
    var isEnded: Bool { status == .ended }

    func totalVotes() -> Int64 {
        return votingResults.reduce(0) { total, optionResults in
            total + optionResults.reduce(0, +)
        }
    }

    func isMultichoice(questionIndex: Int) -> Bool {
        return multichoice & (1 << questionIndex) != 0
    }
}

struct ProposalMetadata {
    let title: String
    let description: String
    let options: [String]
}

enum ProposalParser {
    static func parseDescription(_ description: String) -> ProposalMetadata {
        guard let data = description.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return ProposalMetadata(
                title: String(description.prefix(100)),
                description: description,
                options: []
            )
        }

        let title = json["title"] as? String ?? ""
        let desc = json["description"] as? String ?? ""
        let options = (json["options"] as? [String]) ?? []

        return ProposalMetadata(title: title, description: desc, options: options)
    }

    static func parseVotingWhitelistData(_ whitelistData: [Data]) -> [Int64] {
        guard let data = whitelistData.first, !data.isEmpty else { return [] }

        var result: [Int64] = []

        guard data.count >= 64 else { return result }

        let offset = readUint256(data, byteOffset: 32)
        let offsetInt = Int(offset)
        guard offsetInt + 32 <= data.count else { return result }

        let length = readUint256(data, byteOffset: offsetInt)
        let lengthInt = Int(length)

        for i in 0..<lengthInt {
            let elemStart = offsetInt + 32 + (i * 32)
            guard elemStart + 32 <= data.count else { break }
            let value = readUint256(data, byteOffset: elemStart)
            result.append(Int64(value))
        }

        return result
    }

    private static func readUint256(_ data: Data, byteOffset: Int) -> UInt64 {
        // Read last 8 bytes of 32-byte word (sufficient for values that fit in UInt64)
        let start = byteOffset + 24
        guard start + 8 <= data.count else { return 0 }
        var value: UInt64 = 0
        for i in 0..<8 {
            value = (value << 8) | UInt64(data[start + i])
        }
        return value
    }
}

extension ProposalData {
    static let sample = ProposalData(
        proposalId: 1,
        title: "Community Budget Allocation",
        description: "How should we allocate the community budget?",
        options: [
            ProposalOption(id: 0, name: "Infrastructure"),
            ProposalOption(id: 1, name: "Education"),
            ProposalOption(id: 2, name: "Healthcare")
        ],
        startTimestamp: Int64(Date().timeIntervalSince1970) - 3600,
        endTimestamp: Int64(Date().timeIntervalSince1970) + 86400,
        status: .started,
        votingResults: [[1, 2, 3]],
        multichoice: 0,
        votingContractAddress: "0x0000000000000000000000000000000000000001",
        proposalSMTAddress: "0x0000000000000000000000000000000000000002",
        citizenshipWhitelist: []
    )
}
