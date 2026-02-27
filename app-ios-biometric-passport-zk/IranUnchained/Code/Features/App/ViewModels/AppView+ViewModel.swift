//
//  AppView+ViewModel.swift
//  Verify2024
//
//  Created by Ivan Lele on 19.03.2024.
//

import Identity

import OSLog
import SwiftUI

import Web3
import Alamofire

extension AppView {
    class ViewModel: ObservableObject {
        let config: Config
        
        @Published var isIntroPassed = SimpleStorage.getIsIntroPassed()
        
        @Published var user: User? = nil
        
        @Published var registrationEntities: [RegistrationEntity] = []
        
        init() {
            do {
                config = try Config()
                
                if let activeUserId = SimpleStorage.getActiveUserId() {
                    user = try User.load(activeUserId)
                    if user == nil {
                        SimpleStorage.eraceActiveUserId()
                    }
                }
                
            } catch let error {
                fatalError("appview model error: \(error)")
            }
        }
        
        func registerUserFromPassportScanArtifacts(_ artifacts: PassportScanArtifacts) throws {
            var votingKeys: [String: VotingKey] = [:]
            if let user = try User.load(artifacts.id) {
                votingKeys = user.votingKeys
            }
            
            let user = User(
                id: artifacts.id,
                claimId: artifacts.claimId,
                issuerDid: artifacts.issuerDid,
                secretKey: artifacts.secretKey,
                creationTimestamp: artifacts.creationTimestamp,
                issuingAuthority: artifacts.issuingAuthority,
                votingKeys: votingKeys
            )
            
            self.user = user
            
            try user.save()
            
            SimpleStorage.setActiveUserId(user.id)
        }
        
        func fetchRegistrationEntities() async throws {
            let registryContract = try RegistryEVMContract(config)
            
            let proposer = try EthereumAddress(hex: config.freedom.proposerEVMAddress, eip55: false)
            
            let poolsCount = try await registryContract.poolCountByProposerAndType(
                proposer: proposer,
                type: config.freedom.registryEntryType
            )
            
            let poolsAddresses = try await registryContract.listPoolsByProposerAndType(
                proposer: proposer,
                type: config.freedom.registryEntryType,
                poolCount: poolsCount
            )
            
            for poolAddress in poolsAddresses {
                let registration = try RegistrationEVMContract(config, address: poolAddress)
                
                let registrationInfo = try await registration.getRegistrationInfo()
                
                let regisrtrationRemark = try await RegistrationRemark.fromURL(url: registrationInfo.remark)
                
                let registerVerifierAddress = try await registration.registerVerifier()
                
                let registerVerifier = try RegisterVerifierEVMContract(config, address: registerVerifierAddress)
                
                let countIssuingAuthorityWhitelist = try await registerVerifier.countIssuingAuthorityWhitelist()
                
                var issuingAuthorityWhitelist: [BigUInt] = []
                if !countIssuingAuthorityWhitelist.isZero {
                    issuingAuthorityWhitelist = try await registerVerifier.listIssuingAuthorityWhitelist(0, limit: countIssuingAuthorityWhitelist)
                }
                
                let registrationEntity = RegistrationEntity(
                    address: poolAddress.hex(eip55: false),
                    info: registrationInfo,
                    remark: regisrtrationRemark,
                    issuingAuthorityWhitelist: issuingAuthorityWhitelist
                )
                
                DispatchQueue.main.async {                    
                    self.registrationEntities.append(registrationEntity)
                }
            }
        }
        
        func isUserIdentityFinalized(
            _ stateInfo: StateInfo?
        ) async throws -> (Bool, StateInfo?) {
            guard let user = user else { throw "User not found" }
            
            var stateInfo = stateInfo
            if stateInfo == nil {
                stateInfo = try await getStateInfo(user.issuerDid)
            }
            guard let stateInfo = stateInfo else { throw "State info not found" }
            
            let coreOperation = try await getCoreOperation(stateInfo.lastUpdateOperationIndex)
            
            guard let timestamp = Int(coreOperation.timestamp) else { throw "Invalid timestamp" }
            
            if user.creationTimestamp > timestamp {
                return (false, nil)
            }
            
            if coreOperation.status != "SIGNED" {
                return (false, stateInfo)
            }
            
            return (true, stateInfo)
        }
        
        func getStateInfo(_ issuerDid: String) async throws -> StateInfo {
            var error: NSError?
            let issuerIdHex = IdentityDidHelper().did(toIDHex: issuerDid, error: &error)
            if let error {
                throw error
            }
            
            var requestURL = config.rarimo.rarimoCoreURL
            requestURL.append(path: "/rarimo/rarimo-core/identity/state/\(issuerIdHex)")
            
            let response = try await AF.request(requestURL)
                .serializingDecodable(GetStateInfoResponse.self)
                .result
                .get()
            
            return response.state
        }
        
        func getCoreOperation(_ index: String) async throws -> Operation {
            var requestURL = config.rarimo.rarimoCoreURL
            requestURL.append(path: "/rarimo/rarimo-core/rarimocore/operation/\(index)")
            
            let response = try await AF.request(requestURL)
                .serializingDecodable(OperationData.self)
                .result
                .get()
            
            return response.operation
        }
    }
}
