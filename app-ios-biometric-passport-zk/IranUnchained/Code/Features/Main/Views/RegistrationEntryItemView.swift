import SwiftUI

struct RegistrationEntryItemView: View {
    let registrationEntity: RegistrationEntity
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundStyle(.white)
            VStack {
                Text(registrationEntity.remark.name)
                    .font(.customFont(font: .helvetica, style: .bold, size: 16))
                    .align(.leading)
                    .scenePadding()
                Spacer()
                Text(registrationEntity.remark.description)
                    .font(.customFont(font: .helvetica, style: .regular, size: 14))
                    .multilineTextAlignment(.leading)
                    .align(.leading)
                    .padding(.horizontal)
                    .foregroundStyle(.naturalMain)
                Spacer()
                Text(String(localized: "RegistrationEntryEndAt") + " " + registrationEntity.info.values.commitmentEndTimeDate.formatted())
                    .font(.customFont(font: .helvetica, style: .regular, size: 12))
                    .align(.leading)
                    .scenePadding()
            }
        }
        .frame(width: 343, height: 146)
    }
}

#Preview {
    ZStack {
        Color.lightGrey
            .ignoresSafeArea()
        RegistrationEntryItemView(registrationEntity: RegistrationEntity.sample)
    }
}
