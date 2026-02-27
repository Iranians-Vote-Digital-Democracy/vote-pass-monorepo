import OSLog
import Alamofire
import Foundation

class ProofVerificationRelayer {
    let url: URL
    
    init(url: URL) {
        self.url = url
    }
    
    func register(_ calldata: String) async throws -> RelayerResponse {
        var requestURL = url
        requestURL.append(path: "/integrations/proof-verification-relayer/v1/register")
        
        let calldataRequest = SendCalldataRequest(data: SendCalldataRequestData(txData: "0x" + calldata))
        
        let relayerResponse = try await AF.request(
            requestURL,
            method: .post,
            parameters: calldataRequest,
            encoder: JSONParameterEncoder()
        )
        .serializingDecodable(RelayerResponse.self)
        .result
        .get()
        
        return relayerResponse
    }
}

struct SendCalldataRequest: Codable {
    let data: SendCalldataRequestData
    
    enum CodingKeys: String, CodingKey {
        case data
    }
}

struct SendCalldataRequestData: Codable {
    let txData: String
    
    enum CodingKeys: String, CodingKey {
        case txData = "tx_data"
    }
}

struct RelayerResponse: Codable {
    let id, type: String
    let attributes: RelayerResponseAttributes
}

struct RelayerResponseAttributes: Codable {
    let txHash: String

    enum CodingKeys: String, CodingKey {
        case txHash = "tx_hash"
    }
}
