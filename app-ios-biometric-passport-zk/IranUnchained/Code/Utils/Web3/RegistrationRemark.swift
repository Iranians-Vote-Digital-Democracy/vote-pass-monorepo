import Alamofire
import Foundation

struct RegistrationRemark: Codable {
    let chainID, contractAddress, name, description: String
    let excerpt: String
    let externalURL: String
    let isActive: Bool?
    let metadata: RegistrationRemarkMetadata?
    
    enum CodingKeys: String, CodingKey {
        case chainID = "chain_id"
        case contractAddress = "contract_address"
        case name, description, excerpt
        case externalURL = "external_url"
        case isActive, metadata
    }
    
    static func fromURL(url: String) async throws -> Self {
        return try await AF.request(url)
            .serializingDecodable(Self.self)
            .result
            .get()
    }
}

struct RegistrationRemarkMetadata: Codable {
    let question: String
    let option: String
}
