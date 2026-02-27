//
//  PassportScanProofView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 22.03.2024.
//

import SwiftUI

struct PassportScanProofView: View {
    let data: [String]
    
    let onClick: () -> Void
    
    init(_ passport: Passport, onClick: @escaping () -> Void) {
        var aggregatedData: [String] = []
        
        aggregatedData.append(passport.documentNumber)
        
        let dateFormatter = DateFormatter()
        dateFormatter.timeZone = .gmt
        dateFormatter.dateFormat = "dd/MM/yyyy"
        
        aggregatedData.append(dateFormatter.string(from: passport.dateOfExpiry))
        aggregatedData.append(dateFormatter.string(from: passport.dateOfBirth))
        
        aggregatedData.append(passport.lastName)
        aggregatedData.append(passport.firstName)
        
        aggregatedData.append(passport.issuingAuthority)
        
        self.data = aggregatedData
        self.onClick = onClick
    }
    
    var body: some View {
        VStack {
            PassportScanProofHeaderView()
                .padding()
            ForEach(0..<6, id: \.self) { index in
                PassportScanProofEntryView("ScanDocumentData\(index+1)", data[index])
                    .padding(.horizontal)
                    .padding(.top)
            }
            Spacer()
            Divider()
            GreenButtonView("ScanDocumentProofButton", onClick: onClick)
        }
    }
}

struct PassportScanProofHeaderView: View {
    var body: some View {
        HStack {
            Text("ScanDocumentProofTitle")
                .font(.customFont(font: .helvetica, style: .bold, size: 20))
                .foregroundStyle(.darkBlue)
            Spacer()
        }
    }
}

struct PassportScanProofEntryView: View {
    let key: String
    let value: String
    
    init(_ key: String, _ value: String) {
        self.key = key
        self.value = value
    }
    
    var body: some View {
        HStack {
            Text(LocalizedStringKey(key))
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
                .foregroundStyle(.dullGray)
            GappedLine(gapWidth: 5, lineWidth: 5, lineColor: .dullGray)
                .opacity(0.2)
            .frame(height: 10)
            Text(LocalizedStringKey(value))
                .font(.customFont(font: .helvetica, style: .regular, size: 14))
        }
    }
}



#Preview {
    PassportScanProofView(Passport.sample) {}
}
