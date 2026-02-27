import Web3
import Foundation

struct RegistrationInfo {
    let counters: RegistrationInfoCounters
    let remark: String
    let values: RegistrationInfoValues
    
    init(counters: RegistrationInfoCounters, remark: String, values: RegistrationInfoValues) {
        self.counters = counters
        self.remark = remark
        self.values = values
    }
    
    init(_ rawData: [String: Any]) throws {
        guard let data = rawData[""] as? [String: Any] else {
            throw "unable to get data"
        }
        
        guard let counters = data["counters"] as? [String: Any] else {
            throw "unable to get counters"
        }
        
        guard let totalRegistrations = counters["totalRegistrations"] as? BigUInt else {
            throw "unable to get totalRegistration"
        }
        
        guard let remark = data["remark"] as? String else {
            throw "unable to get remark"
        }
        
        guard let values = data["values"] as? [String: Any] else {
            throw "unable to get values"
        }
        
        guard let commitmentStartTime = values["commitmentStartTime"] as? BigUInt else {
            throw "unable to get commitmentStartTime"
        }
        
        guard let commitmentEndTime = values["commitmentEndTime"] as? BigUInt else {
            throw "unable to get commitmentEndTime"
        }
        
        self.counters = RegistrationInfoCounters(totalRegistrations: totalRegistrations)
        self.remark = remark
        self.values = RegistrationInfoValues(commitmentStartTime: commitmentStartTime, commitmentEndTime: commitmentEndTime)
    }
}

struct RegistrationInfoCounters {
    let totalRegistrations: BigUInt
}

struct RegistrationInfoValues {
    let commitmentStartTime: BigUInt
    let commitmentEndTime: BigUInt
}

extension RegistrationInfoValues {
    var commitmentStartTimeDate: Date {
        Date(timeIntervalSince1970: TimeInterval(commitmentStartTime))
    }
    
    var commitmentEndTimeDate: Date {
        Date(timeIntervalSince1970: TimeInterval(commitmentEndTime))
    }
}
