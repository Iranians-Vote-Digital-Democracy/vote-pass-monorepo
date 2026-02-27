//
//  PassportScanNFCView+ViewModel.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import OSLog
import SwiftUI
import NFCPassportReader

extension PassportScanNFCView {
    class ViewModel: ObservableObject {
        func read(_ mrzKey: String) async throws -> Passport {
            let nfcModel = try await PassportReader()
                .readPassport(
                    mrzKey: mrzKey,
                    tags: [
                        .DG1,
                        .DG2,
                        .SOD,
                    ]
                )

            let dateOfExpiry = nfcModel.documentExpiryDate.parsableDateToDate()
            let dateOfBirth = nfcModel.dateOfBirth.parsableDateToDate()
            
            let calendarDateOfBirth = Calendar.current.dateComponents([.year], from: dateOfBirth).year ?? 0
            let calendarNow = Calendar.current.dateComponents([.year], from: Date()).year ?? 0
            
            if (calendarNow - calendarDateOfBirth) < 16 {
                throw "ValidationUserIsTooYoung"
            }
            
            guard
                let sod = nfcModel.getDataGroup(.SOD) as? SOD,
                let dg1 = nfcModel.getDataGroup(.DG1)
            else {
                throw "Invalid data groups"
            }
            
            
            let certs = try OpenSSLUtils.getX509CertificatesFromPKCS7(pkcs7Der: Data(sod.body))
            
            guard let cert = certs.first else {
                throw "Certificates were not found"
            }
            
            let digestAlgorithm = try sod.getEncapsulatedContentDigestAlgorithm()
            
            var signatureAlgorithm = try sod.getSignatureAlgorithm()
            if signatureAlgorithm == "sha256WithRSAEncryption" {
                signatureAlgorithm = "SHA256withRSA"
            } else if signatureAlgorithm == "sha1WithRSAEncryption" {
                signatureAlgorithm = "SHA1withRSA"
            } else if signatureAlgorithm == "rsaEncryption" && digestAlgorithm == "sha256" {
                signatureAlgorithm = "SHA256withRSA"
            } else if signatureAlgorithm == "rsaEncryption" && digestAlgorithm == "sha1" {
                signatureAlgorithm = "SHA1withRSA"
            }
            
            let signedAttributes = try sod.getSignedAttributes().hex
            let signature = try sod.getSignature().hex
            let encapsulatedContent = try sod.getEncapsulatedContent().hex
            
            let inputs = try prepareInputs(Data(dg1.data))
            
            let (proofRaw, pubSignalsRaw) = try generatePassportVerification(inputs, digestAlgorithm: digestAlgorithm)
            
            let proof = try JSONDecoder().decode(Proof.self, from: proofRaw)
            let pubSignals = try JSONDecoder().decode([String].self, from: pubSignalsRaw)
            
            let zkproof = ZkProof(
                proof: proof,
                pubSignals: pubSignals
            )
                    
            let documentSod = DocumentSod(
                signedAttributes: signedAttributes,
                algorithm: signatureAlgorithm,
                signature: signature,
                pemFile: cert.certToPEM(),
                encapsulatedContent: encapsulatedContent
            )
            
            return Passport(
                id: Data(dg1.data).sha256().hex,
                firstName: nfcModel.firstName,
                lastName: nfcModel.lastName,
                documentNumber: nfcModel.documentNumber,
                issuingAuthority: nfcModel.issuingAuthority,
                dateOfExpiry: dateOfExpiry,
                dateOfBirth: dateOfBirth,
                documentSod: documentSod,
                zkProof: zkproof
            )
        }
        
        func prepareInputs(_ dg1: Data) throws -> Data {
            var calendar = Calendar.current
            calendar.timeZone = .gmt
            calendar.locale = nil
            
            let currentDate = Date()
            
            let currentYear = calendar.component(.year, from: currentDate)-2000
            let currentMonth = calendar.component(.month, from: currentDate)
            let currentDay = calendar.component(.day, from: currentDate)
            
            let inputs = PassportInput(
                inKey: dg1.toCircuitInput(),
                currDateYear: currentYear,
                currDateMonth: currentMonth,
                currDateDay: currentDay,
                credValidYear: currentYear+1,
                credValidMonth: currentMonth,
                credValidDay: currentDay,
                ageLowerbound: 16
            )
            
            return try JSONEncoder().encode(inputs)
        }
        
        func generatePassportVerification(_ inputs: Data, digestAlgorithm: String) throws -> (proof: Data, pubSignals: Data) {
            if digestAlgorithm == "sha256" {
                let witness = try ZKUtils.calcWtnsPassportVerificationSHA256(inputs)
                let (proof, pubSignals) = try ZKUtils.groth16PassportVerificationSHA256Prover(wtns: witness)
                
                return (proof, pubSignals)
            }
            
            if digestAlgorithm == "sha1" {
                let witness = try ZKUtils.calcWtnsPassportVerificationSHA1(inputs)
                let (proof, pubSignals) = try ZKUtils.groth16PassportVerificationSHA1Prover(wtns: witness)
                
                return (proof, pubSignals)
            }
            
            throw "Unsupported digest algorithm"
        }
    }
}

struct PassportImport: Codable {
    var firstName: String
    var lastName: String
    var gender: String
    var passportImageRaw: String?
    var documentType: String
    var issuingAuthority: String
    var documentNumber: String
    var documentExpiryDate: String
    var dateOfBirth: String
    var nationality: String
    let dg1: Data
    let dg15: Data
    let sod: Data
    let signature: Data
}
