import SwiftUI

import Web3
import Web3PromiseKit
import Web3ContractABI

class RegistryEVMContract {
    static let poolsLimit: BigUInt = 1
    
    private let web3: Web3
    private let contract: DynamicContract
    
    init(_ config: Config) throws {
        self.web3 = Web3(rpcURL: config.rarimo.targetChainRPCURL.absoluteString)
        
        let contractAddress = try EthereumAddress(
            hex: config.freedom.registryEvmContractAddress,
            eip55: false
        )
                
        self.contract = try web3.eth.Contract(
            json: NSDataAsset.Storage.registryAbiJson,
            abiKey: nil,
            address: contractAddress
        )
    }
    
    func poolCountByProposerAndType(
        proposer: EthereumAddress,
        type: String
    ) async throws -> BigUInt {
        let method = contract["poolCountByProposerAndType"]!
        
        let result = try method(proposer, type).call().wait()
    
        return try EVMContractUtils.retriveValueFromResult(result)
    }
    
    func listPoolsByProposerAndType(
        proposer: EthereumAddress,
        type: String,
        poolCount: BigUInt
    ) async throws -> [EthereumAddress] {
        let method = contract["listPoolsByProposerAndType"]!
        
        var offset: BigUInt = 0
        if poolCount > Self.poolsLimit {
            offset = poolCount - Self.poolsLimit
        }
        
        let result = try method(proposer, type, offset, Self.poolsLimit).call().wait()
        
        guard let polls = result["pools_"] as? [EthereumAddress] else { throw "result is not [EthereumAddress]" }
        
        return polls
    }
}
