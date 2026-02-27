import SwiftUI

import Web3
import Web3PromiseKit
import Web3ContractABI

class RegisterVerifierEVMContract {
    private let web3: Web3
    private let contract: DynamicContract
    
    init(_ config: Config, address: EthereumAddress) throws {
        self.web3 = Web3(rpcURL: config.rarimo.targetChainRPCURL.absoluteString)
                
        self.contract = try web3.eth.Contract(
            json: NSDataAsset.Storage.iregisterVerifierAbiJson,
            abiKey: nil,
            address: address
        )
    }
    
    func getRegistrationInfo() async throws -> RegistrationInfo {
        let method = contract["getRegistrationInfo"]!
        
        let result = try method().call().wait()
        
        return try RegistrationInfo(result)
    }
    
    func countIssuingAuthorityWhitelist() async throws -> BigUInt {
        let method = contract["countIssuingAuthorityWhitelist"]!
        
        let result = try method().call().wait()
        
        return try EVMContractUtils.retriveValueFromResult(result)
    }
    
    func listIssuingAuthorityWhitelist(_ offset: BigUInt, limit: BigUInt) async throws -> [BigUInt] {
        let method = contract["listIssuingAuthorityWhitelist"]!
        
        let result = try method(offset, limit).call().wait()
        
        return try EVMContractUtils.retriveValueFromResult(result)
    }
}
