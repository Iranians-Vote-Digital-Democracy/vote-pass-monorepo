//
//  PassportScanView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 21.03.2024.
//

import OSLog
import SwiftUI
import Identity
import Alamofire

struct PassportScanView: View {
    @Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>
    
    @EnvironmentObject private var appViewModel: AppView.ViewModel

    @StateObject private var viewModel = ViewModel()
    
    let onFinish: (PassportScanArtifacts) -> Void
    
    @State private var processingStatus: PassportScanProcessingView.Status = .going
    
    @State private var isError = false
    @State private var error = ""
    
    var body: some View {
        VStack {
            Button(action: { presentationMode.wrappedValue.dismiss() }) {
                ZStack {
                    Circle()
                        .foregroundStyle(.white)
                    Image(systemName: "xmark")
                }
            }
            .buttonStyle(.plain)
            .frame(width: 30, height: 30)
            .align()
            .padding(.trailing)
            if viewModel.step == .intro {
                PassportScanIntroView {
                    viewModel.step = .mrz
                }
            }
            if viewModel.step == .mrz {
                PassportScanMRZView(handleMRZKey)
            }
            if viewModel.step == .nfc {
                PassportScanNFCView(viewModel.mrzKey, onCompletion: handleNFC)
            }
            if viewModel.passport != nil && viewModel.step == .processing {
                PassportScanProcessingView(status: $processingStatus, isSigning: false)
                    .onAppear {
                        Task { @MainActor in
                            do {
                                let artifacts = try await startProcessing(viewModel.passport!)
                                
                                try await Task.sleep(nanoseconds: UInt64(5).nano)
                                
                                self.processingStatus = .finished
                                
                                self.onFinish(artifacts)
                                
                                try await Task.sleep(nanoseconds: UInt64(2).nano)
                                
                                presentationMode.wrappedValue.dismiss()
                            } catch {
                                Logger.passportScan.error("passport processing: \(error)")
                                
                                self.processingStatus = .error
                            }
                        }
                    }
            }
        }
        .navigationBarBackButtonHidden(true)
        .alert(isPresented: $isError) {
            Alert(title: Text("Error"), message: Text(LocalizedStringKey(error)), dismissButton: .default(Text("Ok")))
        }
    }
    
    func handleMRZKey(_ mrzKey: String) {
        if mrzKey.isEmpty {
            return
        }
        
        viewModel.mrzKey = mrzKey
        viewModel.step = .nfc
        
        Logger.passportScan.info("MRZ key: \(mrzKey)")
    }
    
    func handleNFC(_ result: Result<Passport, Error>) {
        switch result {
        case .success(let passport):
            self.viewModel.passport = passport
            viewModel.step = .processing
            
            Logger.passportScan.info("Person name: \(passport.firstName) \(passport.lastName)")
        case .failure(let error):
            self.viewModel.step = .mrz
            
            if "\(error)".contains("Validation") {
                self.error = "\(error)"
            } else {
                self.error = "NFCError"
            }
            self.isError = true
            
            Logger.passportScan.error("NFC error: \(error)")
        }
    }
    
    func startProcessing(_ passport: Passport) async throws -> PassportScanArtifacts {
        let secretKey = IdentityNewBJJSecretKey()
        
        var error: NSError? = nil
        let identity = IdentityLoad(secretKey, nil, &error)
        if let error { throw "failed to load identity: \(error)" }
        
        guard let identity else { throw "identity is not initialized" }
        
        var requestUrl = appViewModel.config.kyc.passportKYCURL
        requestUrl.append(path: "/integrations/identity-provider-service/v1/create-identity")
        
        let requestBody = CreateIdentityRequest(
            data: CreateIdentityRequestData(
                id: identity.did(),
                documentSod: passport.documentSod,
                zkproof: passport.zkProof
            )
        )
        
        var request = URLRequest(url: requestUrl)
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let response = try await AF.request(request)
            .serializingDecodable(CreateIdentityResponse.self)
            .result
            .get()
        
        return PassportScanArtifacts(
            id: passport.id,
            claimId: response.data.attributes.claimID,
            issuerDid: response.data.attributes.issuerDid,
            secretKey: secretKey,
            issuingAuthority: passport.issuingAuthority,
            creationTimestamp: Int(Date().timeIntervalSince1970)
        )
    }
}

#Preview {
    PassportScanView() { _ in }
        .environmentObject(AppView.ViewModel())
}
