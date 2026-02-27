//
//  User.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import Foundation

struct VotingKey: Codable {
    let secret: String
    let nullififer: String
    let documentNullifier: String
}

class User: Codable {
    let id: String
    var claimId: String
    var issuerDid: String
    var secretKey: String
    var creationTimestamp: Int
    var issuingAuthority: String
    var votingKeys: [String: VotingKey]
    
    init(id: String, claimId: String, issuerDid: String, secretKey: String, creationTimestamp: Int, issuingAuthority: String, votingKeys: [String : VotingKey]) {
        self.id = id
        self.claimId = claimId
        self.issuerDid = issuerDid
        self.secretKey = secretKey
        self.creationTimestamp = creationTimestamp
        self.issuingAuthority = issuingAuthority
        self.votingKeys = votingKeys
    }
    
    func save() throws {
        do {
            let jsonData = try JSONEncoder().encode(self)
            
            guard let json = String(data: jsonData, encoding: .utf8) else {
                throw "json is not utf8"
            }
            
            try SecureStorage.setValue(json, self.id)
        } catch let error {
            throw "failed to save user: \(error)"
        }
    }
    
    static func load(_ id: String) throws -> Self? {
        do {
            guard let json = try SecureStorage.getValue(id) else {
                return nil
            }
            
            guard let jsonData = json.data(using: .utf8) else {
                throw "invalid utf8 string"
            }
            
            return try JSONDecoder().decode(Self.self, from: jsonData)
        } catch let error  {
            throw "failed to load user: \(error)"
        }
    }
    
    func addVotingKey(registrationAddress: String, keys: VotingKey) throws {
        self.votingKeys[registrationAddress] = keys
        
        try self.save()
    }
    
    func containsVotingKey(_ registrationAddress: String) -> Bool {
        return self.votingKeys.contains { (key, value) in
            return key == registrationAddress
        }
    }
}

extension User {
    func getIssuingAuthorityCode() -> Int {
        return self.issuingAuthority.reversedInt()
    }
}

extension User {
    static let sample = User(
        id: "73f096079902e3c6dae92e0a0bb4923e471be57b6b313b9b815df4b053f2815e",
        claimId: "",
        issuerDid: "",
        secretKey: "",
        creationTimestamp: Int(Date().timeIntervalSince1970),
        issuingAuthority: "UKR",
        votingKeys: [:]
    )
}
