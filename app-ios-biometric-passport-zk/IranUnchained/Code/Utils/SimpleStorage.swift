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
}
