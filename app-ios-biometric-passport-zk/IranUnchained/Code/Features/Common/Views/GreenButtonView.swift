//
//  GreenButtonView.swift
//  IranUnchained
//
//  Created by Ivan Lele on 19.03.2024.
//

import SwiftUI

struct GreenButtonView: View {
    let text: String
    let onClick: () -> Void
    
    init(_ text: String, onClick: @escaping () -> Void) {
        self.text = text
        self.onClick = onClick
    }
    
    var body: some View {
        Button(action: onClick) {
            ZStack {
                RoundedRectangle(cornerRadius: 1_000)
                    .foregroundStyle(.lightGreen)
                Text(LocalizedStringKey(text))
                    .font(.customFont(font: .helvetica, style: .bold, size: 14))
            }
        }
        .buttonStyle(.plain)
        .frame(width: 326, height: 48)
    }
}

#Preview {
    GreenButtonView("Preview") {}
}
