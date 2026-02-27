import OSLog
import Identity
import SwiftUI
import Alamofire

struct VotingView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel
    
    let registrationEntity: RegistrationEntity
    
    let onFinish: () -> Void
    
    var body: some View {
        VStack {
            LottieView(animationFileName: "going", loopMode: .loop)
                .frame(width: 150, height: 150)
            Text("RegistrationLoading")
                .font(.customFont(font: .helvetica, style: .bold, size: 20))
                .multilineTextAlignment(.center)
                .scenePadding()
        }
        .navigationBarBackButtonHidden(true)
        .onAppear(perform: register)
    }
    
    func register() {
        
        Task { @MainActor in
            do {
                try await handleRegistration()
                
                onFinish()
            } catch {
                Logger.main.error("\(error)")
            }
        }
    }
    
    
    func handleRegistration() async throws {
        let chosenRegistrationEntity = registrationEntity
        
        guard let user = appViewModel.user else { throw "user is not initialized" }
        
        let stateProvider = StateProvider(config: appViewModel.config)
        
        var error: NSError? = nil
        let identity = IdentityLoad(
            user.secretKey,
            stateProvider,
            &error
        )
        if let error { throw error }
        guard let identity else { throw "failed to init identity" }
        
        let remark = chosenRegistrationEntity.remark
        
        var claimOfferRequestUrl = appViewModel.config.rarimo.issuerURL
        claimOfferRequestUrl.append(path: "/v1/offer/\(user.claimId)")
        
        let claimOfferData = try await AF.request(claimOfferRequestUrl)
            .serializingData()
            .result
            .get()
        
        var stateInfo: StateInfo? = nil
        while true {
            let (isFinalized, newStateInfo) = try await appViewModel.isUserIdentityFinalized(stateInfo)
            
            if let newStateInfo {
                stateInfo = newStateInfo
            }
            
            if isFinalized {
                break
            }
            
            // sleep 10 second
            try await Task.sleep(nanoseconds: 11_000_000_000)
        }
        
        guard let stateInfo = stateInfo else {
            throw "failed to get state"
        }
        
        let issuingAuthorityCode = user.issuingAuthority.reversedInt()
        let registrationAddress = remark.contractAddress
        
        let registrationData = try identity.register(
            claimOfferData,
            rarimoCoreURL: appViewModel.config.rarimo.rarimoCoreURL.absoluteString,
            issuerDid: user.issuerDid,
            votingAddress: registrationAddress,
            schemaJsonLd: NSDataAsset.Storage.votingCredentialJsonld,
            issuingAuthorityCode: String(issuingAuthorityCode),
            stateInfoJSON: try JSONEncoder().encode(stateInfo)
        )
        
        let relayer = ProofVerificationRelayer(url: appViewModel.config.freedom.proofVerificationRelayerURL)
        let response = try await relayer.register(registrationData.calldata)
        
        Logger.main.info("registration tx hash: \(response.attributes.txHash)")
        
        let votingKeys = VotingKey(
            secret: registrationData.secret,
            nullififer: registrationData.nullifier,
            documentNullifier: registrationData.documentNullifier
        )
        
        try appViewModel.user?.addVotingKey(registrationAddress: registrationEntity.remark.contractAddress, keys: votingKeys)
    }
}

#Preview {
    VotingView(registrationEntity: RegistrationEntity.sample) {}
        .environmentObject(AppView.ViewModel())
}
