//
//  InfoView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 20.03.2024.
//

import SwiftUI

struct InfoView: View {
    let text: String
    let iconName: String
    
    init(_ text: String, iconName: String = "InfoIcon") {
        self.text = text
        self.iconName = iconName
    }
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .foregroundStyle(.dullGray)
                .opacity(0.05)
            HStack {
                Image(iconName)
                Text(LocalizedStringKey(text))
                    .font(.customFont(font: .helvetica, style: .regular, size: 14))
                    .foregroundStyle(.dullGray)
                Spacer()
            }
            .padding()
        }
    }
}

#Preview {
    InfoView("MainProofTabEmpty")
        .frame(width: 326, height: 72)
}
