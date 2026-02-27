package org.iranUnchained.utils

import java.math.BigInteger

/**
 * Pure function to build the circuit inputs JSON for voteSMT proof generation.
 * Extracted from VoteSubmissionService for testability.
 */
object VoteSMTInputsBuilder {

    fun buildJson(
        registrationRootHex: String,
        currentDate: BigInteger,
        proposalEventId: BigInteger,
        nullifier: BigInteger,
        secretKey: BigInteger,
        citizenship: BigInteger,
        identityCreationTimestamp: BigInteger,
        votes: List<BigInteger>,
        proposalId: BigInteger
    ): String {
        val votesStr = votes.joinToString(",") { "\"$it\"" }

        return """
        {
            "root": "$registrationRootHex",
            "currentDate": "${currentDate}",
            "proposalEventId": "${proposalEventId}",
            "nullifier": "${nullifier}",
            "secretKey": "${secretKey}",
            "citizenship": "${citizenship}",
            "identityCreationTimestamp": "${identityCreationTimestamp}",
            "vote": [${votesStr}],
            "proposalId": "${proposalId}"
        }
        """.trimIndent()
    }
}
