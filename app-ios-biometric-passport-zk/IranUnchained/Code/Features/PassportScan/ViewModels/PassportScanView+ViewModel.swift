import SwiftUI

extension PassportScanView {
    class ViewModel: ObservableObject {
        @Published var step: Step = .intro
        
        @Published var mrzKey = ""
        
        @Published var passport: Passport? = nil
        
        enum Step: Int {
            case intro = 0
            case mrz = 1
            case nfc = 2
            case processing = 3
        }
    }
}
