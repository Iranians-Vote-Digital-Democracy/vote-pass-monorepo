import SwiftUI

import Web3
import Web3PromiseKit
import Web3ContractABI

class RegistrationEVMContract {
    private let web3: Web3
    private let contract: DynamicContract
    
    init(_ config: Config, address: EthereumAddress) throws {
        self.web3 = Web3(rpcURL: config.rarimo.targetChainRPCURL.absoluteString)
                
        self.contract = try web3.eth.Contract(
            json: NSDataAsset.Storage.registrationAbiJson,
            abiKey: nil,
            address: address
        )
    }
    
    func getRegistrationInfo() async throws -> RegistrationInfo {
        let method = contract["getRegistrationInfo"]!
        
        let result = try method().call().wait()
        
        return try RegistrationInfo(result)
    }
    
    func commitments(_ commitment: Data) async throws -> Bool {
        let method = contract["commitments"]!
        
        let result = try method(commitment).call().wait()
        
        return try EVMContractUtils.retriveValueFromResult(result)
    }
    
    func registerVerifier() async throws -> EthereumAddress {
        let method = contract["registerVerifier"]!
        
        let result = try method().call().wait()
        
        return try EVMContractUtils.retriveValueFromResult(result)
    }
}
