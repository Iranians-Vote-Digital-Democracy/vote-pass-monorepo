//
//  View.swift
//  IranUnchained
//
//  Created by Ivan Lele on 27.03.2024.
//

import SwiftUI

extension View {
    func align(_ aligment: Alignment = .trailing) -> some View {
        self.frame(maxWidth: .infinity, alignment: aligment)
    }
}
