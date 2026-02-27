package org.iranUnchained

import org.iranUnchained.utils.ProposalParser
import org.junit.Assert.*
import org.junit.Test

class ProposalParserTest {

    // ── parseDescription ────────────────────────────────────────────────

    @Test
    fun `parseDescription - valid JSON with all fields`() {
        val json = """{"title": "Budget Vote", "description": "Allocate funds", "options": ["Parks", "Education"]}"""
        val result = ProposalParser.parseDescription(json)

        assertEquals("Budget Vote", result.title)
        assertEquals("Allocate funds", result.description)
        assertEquals(listOf("Parks", "Education"), result.options)
    }

    @Test
    fun `parseDescription - valid JSON with empty options`() {
        val json = """{"title": "Test", "description": "Desc", "options": []}"""
        val result = ProposalParser.parseDescription(json)

        assertEquals("Test", result.title)
        assertEquals("Desc", result.description)
        assertTrue(result.options.isEmpty())
    }

    @Test
    fun `parseDescription - missing options field`() {
        val json = """{"title": "Test", "description": "Desc"}"""
        val result = ProposalParser.parseDescription(json)

        assertEquals("Test", result.title)
        assertEquals("Desc", result.description)
        assertTrue(result.options.isEmpty())
    }

    @Test
    fun `parseDescription - missing title defaults to empty`() {
        val json = """{"description": "Desc", "options": ["A"]}"""
        val result = ProposalParser.parseDescription(json)

        assertEquals("", result.title)
        assertEquals("Desc", result.description)
        assertEquals(listOf("A"), result.options)
    }

    @Test
    fun `parseDescription - invalid JSON falls back to raw string`() {
        val raw = "This is not JSON"
        val result = ProposalParser.parseDescription(raw)

        assertEquals("This is not JSON", result.title) // take(100) of a short string
        assertEquals("This is not JSON", result.description)
        assertTrue(result.options.isEmpty())
    }

    @Test
    fun `parseDescription - empty string falls back`() {
        val result = ProposalParser.parseDescription("")

        assertTrue(result.options.isEmpty())
    }

    @Test
    fun `parseDescription - long raw string truncates title to 100 chars`() {
        val longString = "A".repeat(200)
        val result = ProposalParser.parseDescription(longString)

        assertEquals(100, result.title.length)
        assertEquals(200, result.description.length)
    }

    @Test
    fun `parseDescription - three options`() {
        val json = """{"title": "T", "description": "D", "options": ["Yes", "No", "Abstain"]}"""
        val result = ProposalParser.parseDescription(json)

        assertEquals(3, result.options.size)
        assertEquals("Yes", result.options[0])
        assertEquals("No", result.options[1])
        assertEquals("Abstain", result.options[2])
    }

    // ── parseVotingWhitelistData ─────────────────────────────────────────

    @Test
    fun `parseVotingWhitelistData - empty list returns empty`() {
        val result = ProposalParser.parseVotingWhitelistData(emptyList())
        assertTrue(result.isEmpty())
    }

    @Test
    fun `parseVotingWhitelistData - empty byte array returns empty`() {
        val result = ProposalParser.parseVotingWhitelistData(listOf(ByteArray(0)))
        assertTrue(result.isEmpty())
    }

    @Test
    fun `parseVotingWhitelistData - all zeros returns empty`() {
        val result = ProposalParser.parseVotingWhitelistData(listOf(ByteArray(64)))
        assertTrue(result.isEmpty())
    }

    @Test
    fun `parseVotingWhitelistData - data too short returns empty`() {
        val result = ProposalParser.parseVotingWhitelistData(listOf(ByteArray(10) { 0xFF.toByte() }))
        assertTrue(result.isEmpty())
    }
}
