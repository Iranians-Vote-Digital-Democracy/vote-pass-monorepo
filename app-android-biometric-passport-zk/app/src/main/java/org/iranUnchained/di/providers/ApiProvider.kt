package org.iranUnchained.di.providers

import org.iranUnchained.data.datasource.api.CircuitBackendApi
import org.web3j.protocol.Web3j

interface ApiProvider {
    val circuitBackend: CircuitBackendApi
    val web3: Web3j
}