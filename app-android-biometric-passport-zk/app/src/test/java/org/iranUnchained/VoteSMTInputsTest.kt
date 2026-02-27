package org.iranUnchained

import com.google.gson.JsonParser
import org.iranUnchained.utils.VoteSMTInputsBuilder
import org.junit.Assert.*
import org.junit.Test

class VoteSMTInputsTest {

    private val defaultPathElements = List(20) { "0" }
    private val defaultPathIndices = List(20) { "0" }

    @Test
    fun `buildJson - produces valid JSON`() {
        val json = VoteSMTInputsBuilder.buildJson(
            root = "abcdef1234567890",
            nullifierHash = "99999",
            nullifier = "12345",
            vote = "1",
            secret = "67890",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertNotNull(parsed)
    }

    @Test
    fun `buildJson - contains all 7 required fields`() {
        val json = VoteSMTInputsBuilder.buildJson(
            root = "abcdef",
            nullifierHash = "100",
            nullifier = "200",
            vote = "1",
            secret = "300",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertTrue(parsed.has("root"))
        assertTrue(parsed.has("nullifierHash"))
        assertTrue(parsed.has("nullifier"))
        assertTrue(parsed.has("vote"))
        assertTrue(parsed.has("secret"))
        assertTrue(parsed.has("pathElements"))
        assertTrue(parsed.has("pathIndices"))
        // Must NOT have old wrong signals
        assertFalse(parsed.has("currentDate"))
        assertFalse(parsed.has("proposalEventId"))
        assertFalse(parsed.has("secretKey"))
        assertFalse(parsed.has("citizenship"))
        assertFalse(parsed.has("identityCreationTimestamp"))
        assertFalse(parsed.has("proposalId"))
    }

    @Test
    fun `buildJson - root field contains hex string`() {
        val json = VoteSMTInputsBuilder.buildJson(
            root = "deadbeef",
            nullifierHash = "1",
            nullifier = "1",
            vote = "1",
            secret = "1",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals("deadbeef", parsed.get("root").asString)
    }

    @Test
    fun `buildJson - vote is a single string not array`() {
        val json = VoteSMTInputsBuilder.buildJson(
            root = "aa",
            nullifierHash = "1",
            nullifier = "1",
            vote = "4",
            secret = "1",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        // vote must be a string, not an array
        assertTrue(parsed.get("vote").isJsonPrimitive)
        assertEquals("4", parsed.get("vote").asString)
    }

    @Test
    fun `buildJson - pathElements is array of 20 strings`() {
        val elements = List(20) { "$it" }
        val json = VoteSMTInputsBuilder.buildJson(
            root = "aa",
            nullifierHash = "1",
            nullifier = "1",
            vote = "1",
            secret = "1",
            pathElements = elements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        val arr = parsed.getAsJsonArray("pathElements")
        assertEquals(20, arr.size())
        assertEquals("0", arr[0].asString)
        assertEquals("19", arr[19].asString)
    }

    @Test
    fun `buildJson - pathIndices is array of 20 strings`() {
        val indices = List(20) { if (it % 2 == 0) "0" else "1" }
        val json = VoteSMTInputsBuilder.buildJson(
            root = "aa",
            nullifierHash = "1",
            nullifier = "1",
            vote = "1",
            secret = "1",
            pathElements = defaultPathElements,
            pathIndices = indices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        val arr = parsed.getAsJsonArray("pathIndices")
        assertEquals(20, arr.size())
        assertEquals("0", arr[0].asString)
        assertEquals("1", arr[1].asString)
    }

    @Test
    fun `buildJson - large values are preserved as strings`() {
        val largeNullifier = "123456789012345678901234567890"
        val json = VoteSMTInputsBuilder.buildJson(
            root = "aa",
            nullifierHash = largeNullifier,
            nullifier = largeNullifier,
            vote = "1",
            secret = "1",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals(largeNullifier, parsed.get("nullifier").asString)
        assertEquals(largeNullifier, parsed.get("nullifierHash").asString)
    }

    @Test
    fun `buildJson - all values are strings`() {
        val json = VoteSMTInputsBuilder.buildJson(
            root = "aa",
            nullifierHash = "42",
            nullifier = "7",
            vote = "2",
            secret = "8",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        // All top-level values must be strings (or string arrays)
        assertTrue(parsed.get("root").isJsonPrimitive)
        assertTrue(parsed.get("nullifierHash").isJsonPrimitive)
        assertTrue(parsed.get("nullifier").isJsonPrimitive)
        assertTrue(parsed.get("vote").isJsonPrimitive)
        assertTrue(parsed.get("secret").isJsonPrimitive)
        // Array elements must be strings
        val el = parsed.getAsJsonArray("pathElements")[0]
        assertTrue(el.isJsonPrimitive)
        assertTrue(el.asJsonPrimitive.isString)
    }

    @Test
    fun `buildJson - zero values`() {
        val json = VoteSMTInputsBuilder.buildJson(
            root = "",
            nullifierHash = "0",
            nullifier = "0",
            vote = "0",
            secret = "0",
            pathElements = List(20) { "0" },
            pathIndices = List(20) { "0" }
        )

        val parsed = JsonParser.parseString(json).asJsonObject
        assertEquals("0", parsed.get("nullifier").asString)
        assertEquals("0", parsed.get("secret").asString)
    }

    @Test
    fun `buildJson - different inputs produce different outputs`() {
        val json1 = VoteSMTInputsBuilder.buildJson(
            root = "aa",
            nullifierHash = "1",
            nullifier = "1",
            vote = "1",
            secret = "1",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )
        val json2 = VoteSMTInputsBuilder.buildJson(
            root = "bb",
            nullifierHash = "1",
            nullifier = "1",
            vote = "1",
            secret = "1",
            pathElements = defaultPathElements,
            pathIndices = defaultPathIndices
        )
        assertNotEquals(json1, json2)
    }
}
