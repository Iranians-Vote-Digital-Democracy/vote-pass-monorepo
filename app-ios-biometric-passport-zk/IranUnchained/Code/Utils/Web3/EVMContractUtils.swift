import Web3

import Foundation

class EVMContractUtils {    
    static func retriveValueFromResult<T>(_ result: [String: Any]) throws -> T {
        guard let value = result[""] as? T else {
            throw "result is not \(T.self)"
        }
        
        return value
    }
}
