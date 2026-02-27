//
//  GappedLine.swift
//  IranUnchained
//
//  Created by Ivan Lele on 27.03.2024.
//

import SwiftUI

struct GappedLine: View {
    let gapWidth: CGFloat
    let lineWidth: CGFloat
    let lineColor: Color

    var body: some View {
        GeometryReader { geometry in
            let totalWidth = geometry.size.width
            let numberOfGaps = Int(totalWidth / (lineWidth + gapWidth))
            let totalGapWidth = CGFloat(numberOfGaps) * gapWidth
            let availableLineWidth = totalWidth - totalGapWidth
            let numberOfRectangles = Int(availableLineWidth / lineWidth)

            HStack(spacing: gapWidth) {
                ForEach(0..<numberOfRectangles, id: \.self) { _ in
                    Rectangle()
                        .fill(lineColor)
                        .frame(width: lineWidth, height: 1)
                }
            }
        }
    }
}


struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        GappedLine(gapWidth: 5, lineWidth: 5, lineColor: .dullGray)
            .opacity(0.2)
    }
}
