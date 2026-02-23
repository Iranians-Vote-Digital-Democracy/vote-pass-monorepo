package org.iranUnchained

import com.google.gson.JsonParser
import org.iranUnchained.utils.VoteSMTInputsBuilder
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class VoteSMTInputsTest {

    @Test
    fun `buildJson - produces valid JSON`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "abcdef1234567890",
            currentDate = BigInteger.valueOf(1710216),
            proposalEventId = BigInteger.valueOf(42),
            nullifier = BigInteger.valueOf(12345),
            secretKey = BigInteger.valueOf(67890),
            citizenship = BigInteger.valueOf(4804178),
            identityCreationTimestamp = BigInteger.valueOf(1700000000),
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.ONE
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertNotNull(parsed)
    }

    @Test
    fun `buildJson - contains all required fields`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "abcdef",
            currentDate = BigInteger.valueOf(100),
            proposalEventId = BigInteger.valueOf(200),
            nullifier = BigInteger.valueOf(300),
            secretKey = BigInteger.valueOf(400),
            citizenship = BigInteger.valueOf(500),
            identityCreationTimestamp = BigInteger.valueOf(600),
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.valueOf(700)
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertTrue(parsed.has("root"))
        assertTrue(parsed.has("currentDate"))
        assertTrue(parsed.has("proposalEventId"))
        assertTrue(parsed.has("nullifier"))
        assertTrue(parsed.has("secretKey"))
        assertTrue(parsed.has("citizenship"))
        assertTrue(parsed.has("identityCreationTimestamp"))
        assertTrue(parsed.has("vote"))
        assertTrue(parsed.has("proposalId"))
    }

    @Test
    fun `buildJson - root field contains hex string`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "deadbeef",
            currentDate = BigInteger.ONE,
            proposalEventId = BigInteger.ONE,
            nullifier = BigInteger.ONE,
            secretKey = BigInteger.ONE,
            citizenship = BigInteger.ONE,
            identityCreationTimestamp = BigInteger.ONE,
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.ONE
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals("deadbeef", parsed.get("root").asString)
    }

    @Test
    fun `buildJson - vote field is array of strings`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "aa",
            currentDate = BigInteger.ONE,
            proposalEventId = BigInteger.ONE,
            nullifier = BigInteger.ONE,
            secretKey = BigInteger.ONE,
            citizenship = BigInteger.ONE,
            identityCreationTimestamp = BigInteger.ONE,
            votes = listOf(BigInteger.valueOf(4), BigInteger.valueOf(8)),
            proposalId = BigInteger.ONE
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        val voteArray = parsed.getAsJsonArray("vote")
        assertEquals(2, voteArray.size())
        assertEquals("4", voteArray[0].asString)
        assertEquals("8", voteArray[1].asString)
    }

    @Test
    fun `buildJson - empty votes array`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "aa",
            currentDate = BigInteger.ONE,
            proposalEventId = BigInteger.ONE,
            nullifier = BigInteger.ONE,
            secretKey = BigInteger.ONE,
            citizenship = BigInteger.ONE,
            identityCreationTimestamp = BigInteger.ONE,
            votes = emptyList(),
            proposalId = BigInteger.ONE
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        val voteArray = parsed.getAsJsonArray("vote")
        assertEquals(0, voteArray.size())
    }

    @Test
    fun `buildJson - large values are preserved as strings`() {
        val largeNullifier = BigInteger("123456789012345678901234567890")
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "aa",
            currentDate = BigInteger.ONE,
            proposalEventId = BigInteger.ONE,
            nullifier = largeNullifier,
            secretKey = BigInteger.ONE,
            citizenship = BigInteger.ONE,
            identityCreationTimestamp = BigInteger.ONE,
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.ONE
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals(largeNullifier.toString(), parsed.get("nullifier").asString)
    }

    @Test
    fun `buildJson - numeric fields are string-encoded`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "aa",
            currentDate = BigInteger.valueOf(42),
            proposalEventId = BigInteger.valueOf(99),
            nullifier = BigInteger.valueOf(7),
            secretKey = BigInteger.valueOf(8),
            citizenship = BigInteger.valueOf(9),
            identityCreationTimestamp = BigInteger.valueOf(10),
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.valueOf(11)
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals("42", parsed.get("currentDate").asString)
        assertEquals("99", parsed.get("proposalEventId").asString)
        assertEquals("11", parsed.get("proposalId").asString)
    }

    @Test
    fun `buildJson - zero values`() {
        val json = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "",
            currentDate = BigInteger.ZERO,
            proposalEventId = BigInteger.ZERO,
            nullifier = BigInteger.ZERO,
            secretKey = BigInteger.ZERO,
            citizenship = BigInteger.ZERO,
            identityCreationTimestamp = BigInteger.ZERO,
            votes = listOf(BigInteger.ZERO),
            proposalId = BigInteger.ZERO
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals("0", parsed.get("currentDate").asString)
        assertEquals("0", parsed.get("nullifier").asString)
    }

    @Test
    fun `buildJson - different inputs produce different outputs`() {
        val json1 = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "aa",
            currentDate = BigInteger.ONE,
            proposalEventId = BigInteger.ONE,
            nullifier = BigInteger.ONE,
            secretKey = BigInteger.ONE,
            citizenship = BigInteger.ONE,
            identityCreationTimestamp = BigInteger.ONE,
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.ONE
        )
        val json2 = VoteSMTInputsBuilder.buildJson(
            registrationRootHex = "bb",
            currentDate = BigInteger.ONE,
            proposalEventId = BigInteger.ONE,
            nullifier = BigInteger.ONE,
            secretKey = BigInteger.ONE,
            citizenship = BigInteger.ONE,
            identityCreationTimestamp = BigInteger.ONE,
            votes = listOf(BigInteger.ONE),
            proposalId = BigInteger.ONE
        )
        assertNotEquals(json1, json2)
    }
}
