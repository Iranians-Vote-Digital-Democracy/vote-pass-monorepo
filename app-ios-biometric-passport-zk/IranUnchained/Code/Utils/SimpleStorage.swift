//
//  SimpleStorage.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import Foundation

class SimpleStorage {
    static let isIntroPassedKey = "IranUnchained.isIntroPassed"
    static let activeUserIdKey = "IranUnchained.activeUserId"
    static let isFirstLaunchEraced = "IranUnchained.isFirstLaunchEraced"
    
    static func setIsIntroPassed(_ value: Bool) {
        UserDefaults.standard.set(value, forKey: Self.isIntroPassedKey)
    }
    
    static func getIsIntroPassed() -> Bool {
        UserDefaults.standard.bool(forKey: Self.isIntroPassedKey)
    }
    
    static func setActiveUserId(_ value: String) {
        UserDefaults.standard.set(value, forKey: Self.activeUserIdKey)
    }
    
    static func getActiveUserId() -> String? {
        UserDefaults.standard.string(forKey: Self.activeUserIdKey)
    }
    
    static func eraceActiveUserId() {
        UserDefaults.standard.removeObject(forKey: Self.activeUserIdKey)
    }
    
    static func setIsFirstLaunchEraced(_ value: Bool) {
        UserDefaults.standard.set(value, forKey: Self.isFirstLaunchEraced)
    }
    
    static func getIsFirstLaunchEraced() -> Bool {
        UserDefaults.standard.bool(forKey: Self.isFirstLaunchEraced)
    }

    // MARK: - Vote Results
    // Stores 1-based option index per proposal ID. -1 means not voted.

    private static func voteResultKey(_ proposalId: Int64) -> String {
        "IranUnchained.voteResult.\(proposalId)"
    }

    static func saveVoteResult(proposalId: Int64, selectedOption: Int) {
        UserDefaults.standard.set(selectedOption, forKey: voteResultKey(proposalId))
    }

    static func getVoteResult(proposalId: Int64) -> Int {
        let key = voteResultKey(proposalId)
        if UserDefaults.standard.object(forKey: key) == nil {
            return -1
        }
        return UserDefaults.standard.integer(forKey: key)
    }
}
