import Web3
import SwiftUI

struct RegistrationEntryView: View {
    @EnvironmentObject private var appViewModel: AppView.ViewModel
    
    let registrationEntity: RegistrationEntity
    
    let onAction: (RegistrationEntity) -> Void
    
    var isUserEligible: Bool {
        guard let user = appViewModel.user else {
            return true
        }
        
        if let isActive = registrationEntity.remark.isActive {
            if !isActive {
                return false
            }
        }
        
        if registrationEntity.status != .voting {
            return false
        }
        
        if !registrationEntity.issuingAuthorityWhitelist.isEmpty {
            if !registrationEntity.issuingAuthorityWhitelist.contains(BigUInt(user.getIssuingAuthorityCode())) {
                return false
            }
        }
        
        if user.containsVotingKey(registrationEntity.remark.contractAddress) {
            return false
        }
        
        return true
    }
    
    var body: some View {
        ZStack {
            Color.lightGrey.ignoresSafeArea()
            VStack {
                header
                    .padding(.vertical)
                description
                if let metadata = registrationEntity.remark.metadata {
                    question(metadata.question)
                }
                Spacer()
                if isUserEligible {
                    actionButton
                }
            }
        }
    }
    
    var header: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundColor(.tomato)
                .opacity(0.5)
            VStack {
                headerStatus
                    .align(.trailing)
                    .scenePadding()
                Spacer()
                Text(registrationEntity.remark.name)
                    .font(.customFont(font: .helvetica, style: .bold, size: 24))
                    .align(.leading)
                    .scenePadding()
            }
        }
        .frame(width: 343, height: 110)
    }
    
    var description: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundStyle(.white)
            VStack {
                Text("Description")
                    .font(.customFont(font: .helvetica, style: .bold, size: 16))
                    .align(.leading)
                    .scenePadding()
                ScrollView {
                    Text(registrationEntity.remark.description)
                        .font(.customFont(font: .helvetica, style: .regular, size: 16))
                        .align(.leading)
                }
                .scenePadding()
                Spacer()
            }
        }
        .frame(width: 343, height: 343)
    }
    
    func question(_ question: String) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundStyle(.white)
            VStack {
                Text("Question")
                    .font(.customFont(font: .helvetica, style: .bold, size: 16))
                    .align(.leading)
                    .scenePadding()
                ScrollView {
                    Text(question)
                        .font(.customFont(font: .helvetica, style: .regular, size: 16))
                        .align(.leading)
                }
                .scenePadding()
            }
        }
        .frame(width: 343, height: 150)
    }
    
    var headerStatus: some View {
        RoundedRectangle(cornerRadius: 8)
            .foregroundStyle(registrationEntity.status.color)
            .overlay {
                Text(registrationEntity.status.rawValue)
                    .font(.customFont(font: .helvetica, style: .bold, size: 14))
                    .foregroundStyle(.white)
            }
            .frame(width: 64, height: 18)
    }
    
    var actionButton: some View {
        Button(action: {
            onAction(registrationEntity)
        }) {
            ZStack {
                RoundedRectangle(cornerRadius: 24)
                    .foregroundStyle(.tomato)
                Text(registrationEntity.remark.metadata?.option ?? "")
                    .font(.customFont(font: .helvetica, style: .bold, size: 16))
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(.plain)
        .frame(width: 343, height: 46)
    }
}

#Preview {
    RegistrationEntryView(registrationEntity: RegistrationEntity.sample) { _ in }
        .environmentObject(AppView.ViewModel())
}
