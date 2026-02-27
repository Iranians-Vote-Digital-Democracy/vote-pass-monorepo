//
//  SecureStorage.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import KeychainAccess

class SecureStorage {
    static let keychain = Keychain(service: "IranUnchained.secureStorage")
    
    static func eraceAll() throws {
        try keychain.removeAll()
    }
    
    static func setValue(_ value: String, _ key: String) throws {
        try Self.keychain.set(value, key: key)
    }
    
    static func getValue(_ key: String) throws -> String? {
        try Self.keychain.get(key)
    }
    
    static func eraceValue(_ key: String) throws {
        try Self.keychain.remove(key)
    }
}
