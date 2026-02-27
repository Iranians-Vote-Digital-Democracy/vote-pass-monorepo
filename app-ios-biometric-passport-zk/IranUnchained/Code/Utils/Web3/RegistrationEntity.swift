import Web3
import SwiftUI
import Foundation

enum RegistrationEntityStatus: String, CaseIterable {
    case voting = "Voting"
    case pending = "Pending"
    case completed = "Completed"
}

extension RegistrationEntityStatus {
    var color: Color {
        switch self {
        case .pending:
            return .yellow
        case .voting:
            return .blue
        case .completed:
            return .black
        }
    }
}

struct RegistrationEntity {
    let address: String
    let info: RegistrationInfo
    let remark: RegistrationRemark
    let issuingAuthorityWhitelist: [BigUInt]
    
    func isEnded() -> Bool {
        return BigUInt(Date().timeIntervalSince1970) > info.values.commitmentEndTime
    }
}

extension RegistrationEntity {
    var status: RegistrationEntityStatus {
        let currentTime = BigUInt(Date().timeIntervalSince1970)
        
        if currentTime < info.values.commitmentStartTime {
            return .pending
        } else if currentTime < info.values.commitmentEndTime {
            return .voting
        } else {
            return .completed
        }
    }
}


extension RegistrationEntity {
    static let sample = Self(
        address: "0x0000000000000000000000000000000000000000",
        info: RegistrationInfo(
            counters: RegistrationInfoCounters(totalRegistrations: 500),
            remark: "https://example.com",
            values: RegistrationInfoValues(
                commitmentStartTime: BigUInt(Date().timeIntervalSince1970),
                commitmentEndTime: BigUInt(Date().timeIntervalSince1970 + 60 * 60)
            )
        ),
        remark: RegistrationRemark(
            chainID: "1",
            contractAddress: "0x0000000000000000000000000000000000000000",
            name: "Cool Poll",
            description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec eu tortor sed nibh bibendum efficitur.",
            excerpt: "Short description",
            externalURL: "https://example.com",
            isActive: true,
            metadata: RegistrationRemarkMetadata(
                question: "Yes?",
                option: "Yes"
            )
        ),
        issuingAuthorityWhitelist: []
    )
}
