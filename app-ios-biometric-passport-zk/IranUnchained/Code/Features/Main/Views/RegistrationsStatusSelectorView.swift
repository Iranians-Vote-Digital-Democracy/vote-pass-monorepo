import SwiftUI

struct RegistrationsStatusSelectorView: View {
    @Binding var selectedStatus: RegistrationEntityStatus
    
    var body: some View {
        Picker("Status", selection: $selectedStatus) {
            ForEach(RegistrationEntityStatus.allCases, id: \.self) {
                Text($0.rawValue)
                    .font(.customFont(font: .helvetica, style: .bold, size: 12))
            }
        }
        .pickerStyle(.segmented)
        .frame(width: 320)
    }
}

#Preview {
    return RegistrationsStatusSelectorView(selectedStatus: .constant(.voting))
}
