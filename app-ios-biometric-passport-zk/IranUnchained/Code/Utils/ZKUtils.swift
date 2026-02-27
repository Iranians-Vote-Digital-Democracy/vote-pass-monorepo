import OSLog
import SwiftUI

class ZKUtils {
    static public func calcWtnsPassportVerificationSHA1(
        _ privateInputsJson: Data
    ) throws -> Data {
        let descriptionFileData = NSDataAsset.Storage.passportVerificationSHA1Dat
        
        return try _calcWtnsPassportVerificationSHA1(descriptionFileData, privateInputsJson)
    }
    
    static public func calcWtnsPassportVerificationSHA256(
        _ privateInputsJson: Data
    ) throws -> Data {
        let descriptionFileData = NSDataAsset.Storage.passportVerificationSHA256Dat
        
        return try _calcWtnsPassportVerificationSHA256(descriptionFileData, privateInputsJson)
    }
    
    static public func calcWtnsAuthV2(
        _ privateInputsJson: Data
    ) throws -> Data {
        let descriptionFileData = NSDataAsset.Storage.authV2Dat
        
        return try _calcWtnsAuthV2(descriptionFileData, privateInputsJson)
    }
    
    static public func calcWtnsCredentialAtomicQueryMTPV2OnChainVoting(
        _ privateInputsJson: Data
    ) throws -> Data {
        let descriptionFileData = NSDataAsset.Storage.credentialAtomicQueryMTPV2OnChainVotingDat
        
        return try _calcWtnsCredentialAtomicQueryMTPV2OnChainVoting(descriptionFileData, privateInputsJson)
    }
    
    static public func calcWtnsVoteSMT(
        _ privateInputsJson: Data
    ) throws -> Data {
        let descriptionFileData = NSDataAsset.Storage.voteSMTDat
        
        return try _calcWtnsVoteSMT(descriptionFileData, privateInputsJson)
    }
    
    static private func _calcWtnsPassportVerificationSHA1(
        _ descriptionFileData: Data,
        _ privateInputsJson: Data
    ) throws -> Data {
#if targetEnvironment(simulator)
        return Data()
#else
        let errorSize = UInt(256);
        
        let wtnsSize = UnsafeMutablePointer<UInt>.allocate(capacity: Int(1));
        wtnsSize.initialize(to: UInt(100 * 1024 * 1024 ))
        
        let wtnsBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: (100 * 1024 * 1024))
        let errorBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(errorSize))
        
        let result = witnesscalc_passportVerificationSHA1(
            (descriptionFileData as NSData).bytes, UInt(descriptionFileData.count),
            (privateInputsJson as NSData).bytes, UInt(privateInputsJson.count),
            wtnsBuffer, wtnsSize,
            errorBuffer, errorSize
        )
        
        if result == WITNESSCALC_ERROR {
            throw String(bytes: Data(bytes: errorBuffer, count: Int(errorSize)), encoding: .utf8)!
                .replacingOccurrences(of: "\0", with: "")
        }
        
        if result == WITNESSCALC_ERROR_SHORT_BUFFER {
            throw String("Buffer to short, should be at least: \(wtnsSize.pointee)")
        }
        
        return Data(bytes: wtnsBuffer, count: Int(wtnsSize.pointee))
#endif
    }
    
    static private func _calcWtnsPassportVerificationSHA256(
        _ descriptionFileData: Data,
        _ privateInputsJson: Data
    ) throws -> Data {
#if targetEnvironment(simulator)
        return Data()
#else
        let errorSize = UInt(256);
        
        let wtnsSize = UnsafeMutablePointer<UInt>.allocate(capacity: Int(1));
        wtnsSize.initialize(to: UInt(100 * 1024 * 1024 ))
        
        let wtnsBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: (100 * 1024 * 1024))
        let errorBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(errorSize))
        
        let result = witnesscalc_passportVerificationSHA256(
            (descriptionFileData as NSData).bytes, UInt(descriptionFileData.count),
            (privateInputsJson as NSData).bytes, UInt(privateInputsJson.count),
            wtnsBuffer, wtnsSize,
            errorBuffer, errorSize
        )
        
        if result == WITNESSCALC_ERROR {
            throw String(bytes: Data(bytes: errorBuffer, count: Int(errorSize)), encoding: .utf8)!
                .replacingOccurrences(of: "\0", with: "")
        }
        
        if result == WITNESSCALC_ERROR_SHORT_BUFFER {
            throw String("Buffer to short, should be at least: \(wtnsSize.pointee)")
        }
        
        return Data(bytes: wtnsBuffer, count: Int(wtnsSize.pointee))
#endif
    }
    
    static private func _calcWtnsCredentialAtomicQueryMTPV2OnChainVoting(
        _ descriptionFileData: Data,
        _ privateInputsJson: Data
    ) throws -> Data {
#if targetEnvironment(simulator)
        return Data()
#else
        let errorSize = UInt(256);
        
        let wtnsSize = UnsafeMutablePointer<UInt>.allocate(capacity: Int(1));
        wtnsSize.initialize(to: UInt(100 * 1024 * 1024 ))
        
        let wtnsBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: (100 * 1024 * 1024))
        let errorBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(errorSize))
        
        let result = witnesscalc_credentialAtomicQueryMTPV2OnChainVoting(
            (descriptionFileData as NSData).bytes, UInt(descriptionFileData.count),
            (privateInputsJson as NSData).bytes, UInt(privateInputsJson.count),
            wtnsBuffer, wtnsSize,
            errorBuffer, errorSize
        )
        
        if result == WITNESSCALC_ERROR {
            throw String(bytes: Data(bytes: errorBuffer, count: Int(errorSize)), encoding: .utf8)!
                .replacingOccurrences(of: "\0", with: "")
        }
        
        if result == WITNESSCALC_ERROR_SHORT_BUFFER {
            throw String("Buffer to short, should be at least: \(wtnsSize.pointee)")
        }
        
        return Data(bytes: wtnsBuffer, count: Int(wtnsSize.pointee))
#endif
    }
    
    static private func _calcWtnsAuthV2(
        _ descriptionFileData: Data,
        _ privateInputsJson: Data
    ) throws -> Data {
#if targetEnvironment(simulator)
        return Data()
#else
        let errorSize = UInt(256);
        
        let wtnsSize = UnsafeMutablePointer<UInt>.allocate(capacity: Int(1));
        wtnsSize.initialize(to: UInt(100 * 1024 * 1024 ))
        
        let wtnsBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: (100 * 1024 * 1024))
        let errorBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(errorSize))
        
        let result = witnesscalc_authV2(
            (descriptionFileData as NSData).bytes, UInt(descriptionFileData.count),
            (privateInputsJson as NSData).bytes, UInt(privateInputsJson.count),
            wtnsBuffer, wtnsSize,
            errorBuffer, errorSize
        )
        
        if result == WITNESSCALC_ERROR {
            throw String(bytes: Data(bytes: errorBuffer, count: Int(errorSize)), encoding: .utf8)!
                .replacingOccurrences(of: "\0", with: "")
        }
        
        if result == WITNESSCALC_ERROR_SHORT_BUFFER {
            throw String("Buffer to short, should be at least: \(wtnsSize.pointee)")
        }
        
        return Data(bytes: wtnsBuffer, count: Int(wtnsSize.pointee))
#endif
    }
    
    static private func _calcWtnsVoteSMT(
        _ descriptionFileData: Data,
        _ privateInputsJson: Data
    ) throws -> Data {
#if targetEnvironment(simulator)
        return Data()
#else
        let errorSize = UInt(256);
        
        let wtnsSize = UnsafeMutablePointer<UInt>.allocate(capacity: Int(1));
        wtnsSize.initialize(to: UInt(100 * 1024 * 1024 ))
        
        let wtnsBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: (100 * 1024 * 1024))
        let errorBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(errorSize))
        
        let result = witnesscalc_voteSMT(
            (descriptionFileData as NSData).bytes, UInt(descriptionFileData.count),
            (privateInputsJson as NSData).bytes, UInt(privateInputsJson.count),
            wtnsBuffer, wtnsSize,
            errorBuffer, errorSize
        )
        
        if result == WITNESSCALC_ERROR {
            throw String(bytes: Data(bytes: errorBuffer, count: Int(errorSize)), encoding: .utf8)!
                .replacingOccurrences(of: "\0", with: "")
        }
        
        if result == WITNESSCALC_ERROR_SHORT_BUFFER {
            throw String("Buffer to short, should be at least: \(wtnsSize.pointee)")
        }
        
        return Data(bytes: wtnsBuffer, count: Int(wtnsSize.pointee))
#endif
    }
    
    static public func groth16PassportVerificationSHA1Prover(wtns: Data) throws -> (proof: Data, publicInputs: Data) {
        return try _groth16Prover(zkey: NSDataAsset.Storage.passportVerificationSHA1Zkey, wtns: wtns)
    }
    
    static public func groth16PassportVerificationSHA256Prover(wtns: Data) throws -> (proof: Data, publicInputs: Data) {
        return try _groth16Prover(zkey: NSDataAsset.Storage.passportVerificationSHA256Zkey, wtns: wtns)
    }
    
    static public func groth16AuthV2(wtns: Data) throws -> (proof: Data, publicInputs: Data) {
        return try _groth16Prover(zkey: NSDataAsset.Storage.authV2Zkey, wtns: wtns)
    }
    
    static public func groth16CredentialAtomicQueryMTPV2OnChainVoting(wtns: Data) throws -> (proof: Data, publicInputs: Data) {
        return try _groth16Prover(zkey: NSDataAsset.Storage.credentialAtomicQueryMTPV2OnChainVotingZkey, wtns: wtns)
    }
    
    static public func groth16VoteSMT(wtns: Data) throws -> (proof: Data, publicInputs: Data) {
        return try _groth16Prover(zkey: NSDataAsset.Storage.voteSMTZkey, wtns: wtns)
    }

    static private func _groth16Prover(zkey: Data, wtns: Data) throws -> (proof: Data, publicInputs: Data) {
#if targetEnvironment(simulator)
        return (Data(), Data())
#else
        var proofSize: UInt = 4 * 1024 * 1024
        var publicSize: UInt = 4 * 1024 * 1024
        
        let proofBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(proofSize))
        let publicBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: Int(publicSize))
        
        let errorBuffer = UnsafeMutablePointer<Int8>.allocate(capacity: 256)
        let errorMaxSize: UInt = 256
        
        let result = groth16_prover(
            (zkey as NSData).bytes, UInt(zkey.count),
            (wtns as NSData).bytes, UInt(wtns.count),
            proofBuffer, &proofSize,
            publicBuffer, &publicSize,
            errorBuffer, errorMaxSize
        )
        
        if result == PROVER_ERROR {
            throw String(bytes: Data(bytes: errorBuffer, count: Int(errorMaxSize)), encoding: .utf8)!
                .replacingOccurrences(of: "\0", with: "")
        }
        
        if result == PROVER_ERROR_SHORT_BUFFER {
            throw "Proof or public inpurs buffer is too short"
        }
        
        var proof = Data(bytes: proofBuffer, count: Int(proofSize))
        var publicInputs = Data(bytes: publicBuffer, count: Int(publicSize))
        
        let proofNullIndex = proof.firstIndex(of: 0x00)!
        let publicInputsNullIndex = publicInputs.firstIndex(of: 0x00)!
        
        proof = proof[0..<proofNullIndex]
        publicInputs = publicInputs[0..<publicInputsNullIndex]
        
        return (proof: proof, publicInputs: publicInputs)
#endif
    }
}
