//
//  RawRPCClient.swift
//  IranUnchained
//
//  Lightweight JSON-RPC client for eth_call and eth_sendRawTransaction.
//  Avoids web3.swift's broken struct decoders.
//

import Foundation

enum RPCError: Error, LocalizedError {
    case httpError(statusCode: Int)
    case rpcError(code: Int, message: String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .httpError(let code): return "HTTP error \(code)"
        case .rpcError(_, let message): return "RPC error: \(message)"
        case .invalidResponse: return "Invalid RPC response"
        }
    }
}

class RawRPCClient {
    let rpcURL: URL
    private var nextId: Int = 1

    init(rpcURL: URL) {
        self.rpcURL = rpcURL
    }

    /// Make an eth_call and return the hex result (without 0x prefix).
    func ethCall(to: String, data: String) async throws -> String {
        let params: [[String: String]] = [
            ["to": to, "data": data],
        ]
        let result = try await call(method: "eth_call", params: params + ["latest" as Any] as [Any])
        guard let hex = result as? String else {
            throw RPCError.invalidResponse
        }
        return hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
    }

    /// Send a raw signed transaction and return the tx hash.
    func sendRawTransaction(signedTx: String) async throws -> String {
        let result = try await call(method: "eth_sendRawTransaction", params: [signedTx])
        guard let txHash = result as? String else {
            throw RPCError.invalidResponse
        }
        return txHash
    }

    /// Get current gas price.
    func gasPrice() async throws -> String {
        let result = try await call(method: "eth_gasPrice", params: [])
        guard let hex = result as? String else {
            throw RPCError.invalidResponse
        }
        return hex
    }

    /// Get transaction count (nonce) for an address.
    func getTransactionCount(address: String) async throws -> String {
        let result = try await call(method: "eth_getTransactionCount", params: [address, "latest"])
        guard let hex = result as? String else {
            throw RPCError.invalidResponse
        }
        return hex
    }

    /// Send a raw JSON-RPC call.
    func sendTransaction(params: [String: Any]) async throws -> String {
        let result = try await call(method: "eth_sendTransaction", params: [params])
        guard let txHash = result as? String else {
            throw RPCError.invalidResponse
        }
        return txHash
    }

    // MARK: - Private

    private func call(method: String, params: [Any]) async throws -> Any {
        let id = nextId
        nextId += 1

        let body: [String: Any] = [
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": id
        ]

        var request = URLRequest(url: rpcURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
            throw RPCError.httpError(statusCode: httpResponse.statusCode)
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw RPCError.invalidResponse
        }

        if let error = json["error"] as? [String: Any] {
            let code = error["code"] as? Int ?? -1
            let message = error["message"] as? String ?? "Unknown error"
            throw RPCError.rpcError(code: code, message: message)
        }

        guard let result = json["result"] else {
            throw RPCError.invalidResponse
        }

        return result
    }
}
