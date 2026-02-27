//
//  NSDataAsset.swift
//  IranUnchained
//
//  Created by Ivan Lele on 28.03.2024.
//

import SwiftUI

extension NSDataAsset {
    class Storage {
        static let passportVerificationSHA1Dat = NSDataAsset(name: "passportVerificationSHA1.dat")?.data ?? Data()
        
        static let passportVerificationSHA256Dat = NSDataAsset(name: "passportVerificationSHA256.dat")?.data ?? Data()
        
        static let authV2Dat = NSDataAsset(name: "authV2.dat")?.data ?? Data()
        
        static let credentialAtomicQueryMTPV2OnChainVotingDat = NSDataAsset(name: "credentialAtomicQueryMTPV2OnChainVoting.dat")?.data ?? Data()
        
        static let voteSMTDat = NSDataAsset(name: "voteSMT.dat")?.data ?? Data()
        
        static let passportVerificationSHA1Zkey = NSDataAsset(name: "passportVerificationSHA1.zkey")?.data ?? Data()
        
        static let passportVerificationSHA256Zkey = NSDataAsset(name: "passportVerificationSHA256.zkey")?.data ?? Data()
        
        static let authV2Zkey = NSDataAsset(name: "authV2.zkey")?.data ?? Data()
        
        static let credentialAtomicQueryMTPV2OnChainVotingZkey = NSDataAsset(name: "credentialAtomicQueryMTPV2OnChainVoting.zkey")?.data ?? Data()
        
        static let voteSMTZkey = NSDataAsset(name: "voteSMT.zkey")?.data ?? Data()
        
        static let votingCredentialJsonld = NSDataAsset(name: "VotingCredential.jsonld")?.data ?? Data()
        
        static let registrationAbiJson = NSDataAsset(name: "RegistrationABI.json")?.data ?? Data()
        
        static let registryAbiJson = NSDataAsset(name: "RegistryABI.json")?.data ?? Data()
        
        static let iregisterVerifierAbiJson = NSDataAsset(name: "IRegisterVerifierABI.json")?.data ?? Data()
    }
}
