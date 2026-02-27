package org.iranUnchained.utils

/**
 * Builds the circuit inputs JSON for voteSMT (Semaphore-style SMT voting) proof generation.
 *
 * The vote_smt circuit proves knowledge of a secret + Merkle path in the registration SMT.
 * Identity fields (citizenship, timestamps) are committed into the SMT leaf during registration —
 * the voting circuit only needs: root, nullifierHash, nullifier, vote, secret, pathElements, pathIndices.
 */
object VoteSMTInputsBuilder {

    fun buildJson(
        root: String,
        nullifierHash: String,
        nullifier: String,
        vote: String,
        secret: String,
        pathElements: List<String>,
        pathIndices: List<String>
    ): String {
        val pathElementsStr = pathElements.joinToString(",") { "\"$it\"" }
        val pathIndicesStr = pathIndices.joinToString(",") { "\"$it\"" }

        return """
        {
            "root": "$root",
            "nullifierHash": "$nullifierHash",
            "nullifier": "$nullifier",
            "vote": "$vote",
            "secret": "$secret",
            "pathElements": [$pathElementsStr],
            "pathIndices": [$pathIndicesStr]
        }
        """.trimIndent()
    }
}
