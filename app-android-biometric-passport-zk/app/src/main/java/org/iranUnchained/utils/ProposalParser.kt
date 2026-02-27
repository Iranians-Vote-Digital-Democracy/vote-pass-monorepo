package org.iranUnchained.utils

import com.google.gson.JsonParser
import org.iranUnchained.data.models.ProposalMetadata
import java.math.BigInteger

/**
 * Pure parsing functions for proposal data, extracted from ProposalProvider.
 * No Android Context dependency — testable on JVM.
 */
object ProposalParser {

    /**
     * Parse a proposal description JSON string into ProposalMetadata.
     *
     * Expected format: {"title": "...", "description": "...", "options": ["A", "B"]}
     * Falls back to using the raw string as title+description if JSON parsing fails.
     */
    fun parseDescription(description: String): ProposalMetadata {
        return try {
            val json = JsonParser.parseString(description).asJsonObject
            ProposalMetadata(
                title = json.get("title")?.asString ?: "",
                description = json.get("description")?.asString ?: "",
                options = json.getAsJsonArray("options")?.map { it.asString } ?: emptyList()
            )
        } catch (e: Exception) {
            ProposalMetadata(
                title = description.take(100),
                description = description,
                options = emptyList()
            )
        }
    }

    /**
     * Parse ABI-encoded voting whitelist data into a list of citizenship codes.
     *
     * The data encodes a ProposalRules struct containing a uint256[] citizenshipWhitelist.
     * Returns an empty list if the data is empty or unparseable.
     */
    fun parseVotingWhitelistData(whitelistData: List<ByteArray>): List<Long> {
        if (whitelistData.isEmpty()) return emptyList()

        return try {
            val data = whitelistData[0]
            if (data.isEmpty()) return emptyList()

            val result = mutableListOf<Long>()
            val bi = BigInteger(1, data)
            if (bi != BigInteger.ZERO) {
                if (data.size >= 64) {
                    val offsetBytes = data.copyOfRange(32, 64)
                    val offset = BigInteger(1, offsetBytes).toInt()

                    if (offset + 32 <= data.size) {
                        val lengthBytes = data.copyOfRange(offset, offset + 32)
                        val length = BigInteger(1, lengthBytes).toInt()

                        for (i in 0 until length) {
                            val elemStart = offset + 32 + (i * 32)
                            if (elemStart + 32 <= data.size) {
                                val elemBytes = data.copyOfRange(elemStart, elemStart + 32)
                                result.add(BigInteger(1, elemBytes).toLong())
                            }
                        }
                    }
                }
            }
            result
        } catch (e: Exception) {
            emptyList()
        }
    }
}
