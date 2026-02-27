//
//  Config.swift
//  IranUnchained
//
//  Created by Ivan Lele on 18.03.2024.
//

import Foundation

class Config {
    let general: General
    let kyc: KYC
    let rarimo: Rarimo
    let freedom: Freedom
    
    init() throws {
        self.general = try General()
        self.kyc = try KYC()
        self.rarimo = try Rarimo()
        self.freedom = try Freedom()
    }
}

extension Config {
    class General {
        let privacyPolicyURL: URL
        let termsOfUseURL: URL
        
        init() throws {
            guard
                var privacyPolicyURLRaw = Bundle.main.object(forInfoDictionaryKey: "PRIVACY_POLICY_URL") as? String,
                var termsOfUseURLRaw = Bundle.main.object(forInfoDictionaryKey: "TERMS_OF_USE_URL") as? String
            else {
                throw "some config value aren't initialized"
            }
            
            privacyPolicyURLRaw = String(privacyPolicyURLRaw.dropFirst())
            privacyPolicyURLRaw = String(privacyPolicyURLRaw.dropLast())
            
            termsOfUseURLRaw = String(termsOfUseURLRaw.dropFirst())
            termsOfUseURLRaw = String(termsOfUseURLRaw.dropLast())
            
            guard
                let privacyPolicyURL = URL(string: privacyPolicyURLRaw),
                let termsOfUseURL = URL(string: termsOfUseURLRaw)
            else {
                throw "PRIVACY_POLICY_URL and/or TERMS_OF_USE_URL aren't URLs"
            }
            
            self.privacyPolicyURL = privacyPolicyURL
            self.termsOfUseURL = termsOfUseURL
        }
    }
}

extension Config {
    class KYC {
        let passportKYCURL: URL
        
        init() throws {
            guard
                var passportKYCURLRaw = Bundle.main.object(forInfoDictionaryKey: "PASSPORT_KYC_URL") as? String
            else {
                throw "some config value aren't initialized"
            }
            
            passportKYCURLRaw = String(passportKYCURLRaw.dropFirst())
            passportKYCURLRaw = String(passportKYCURLRaw.dropLast())
            
            guard
                let passportKYCURL = URL(string: passportKYCURLRaw)
            else {
                throw "PASSPORT_KYC_URL aren't URLs"
            }
            
            self.passportKYCURL = passportKYCURL
        }
    }
}

extension Config {
    class Rarimo {
        let rarimoCoreURL: URL
        let targetChainRPCURL: URL
        let issuerURL: URL
        let votingCredentialType: String
        
        init() throws {
            guard
                var rarimoCoreURLRaw = Bundle.main.object(forInfoDictionaryKey: "RARIMO_CORE_URL") as? String,
                var targetChainRPCURLRaw = Bundle.main.object(forInfoDictionaryKey: "TARGET_CHAIN_RPC_URL") as? String,
                var issuerURLRaw = Bundle.main.object(forInfoDictionaryKey: "ISSUER_URL") as? String,
                let votingCredentialType = Bundle.main.object(forInfoDictionaryKey: "VOTING_CREDENTIAL_TYPE") as? String
            else {
                throw "some config value aren't initialized"
            }
            
            rarimoCoreURLRaw = String(rarimoCoreURLRaw.dropFirst())
            rarimoCoreURLRaw = String(rarimoCoreURLRaw.dropLast())

            targetChainRPCURLRaw = String(targetChainRPCURLRaw.dropFirst())
            targetChainRPCURLRaw = String(targetChainRPCURLRaw.dropLast())
            
            issuerURLRaw = String(issuerURLRaw.dropFirst())
            issuerURLRaw = String(issuerURLRaw.dropLast())
            
            guard
                let rarimoCoreURL = URL(string: rarimoCoreURLRaw),
                let targetChainRPCURL = URL(string: targetChainRPCURLRaw),
                let issuerURL = URL(string: issuerURLRaw)
            else {
                throw "RARIMO_CORE_URL/TARGET_CHAIN_RPC_URL/ISSUER_URL aren't URLs"
            }
            
            self.rarimoCoreURL = rarimoCoreURL
            self.targetChainRPCURL = targetChainRPCURL
            self.issuerURL = issuerURL
            self.votingCredentialType = String(votingCredentialType.dropFirst().dropLast())
        }
    }
}

extension Config {
    class Freedom {
        let registryEvmContractAddress: String
        let proposerEVMAddress: String
        let registryEntryType: String
        let proofVerificationRelayerURL: URL
        
        init() throws {
            self.registryEvmContractAddress = try readStringFromInfoPlist(key: "REGISTRY_EVM_CONTRACT_ADDRESS")
            self.proposerEVMAddress = try readStringFromInfoPlist(key: "PROPOSER_EVM_ADDRESS")
            self.registryEntryType = try readStringFromInfoPlist(key: "REGISTRY_ENTRY_TYPE")
            self.proofVerificationRelayerURL = try readURLFromInfoPlist(key: "PROOF_VERIFICATION_RELAYER_URL")
        }
    }
}

// Although we normally return an optional parameter when we get some value for a key,
// in our case it is better to throw an error to improve the readability of errors
fileprivate func readStringFromInfoPlist(key: String) throws -> String {
    guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
        throw "Couldn't find \(key) in Info.plist"
    }
    
    return String(value.dropFirst().dropLast())
}

fileprivate func readURLFromInfoPlist(key: String) throws -> URL {
    let value = try readStringFromInfoPlist(key: key)
    
    guard let url = URL(string: value) else { throw "\(key) isn't URL" }
    
    return url
}
