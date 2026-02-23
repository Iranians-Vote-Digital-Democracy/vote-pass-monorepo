package org.iranUnchained

import org.iranUnchained.utils.CalldataEncoder
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class CalldataEncoderTest {

    @Test
    fun `encodeVoteBitmasks - option 0 yields 1`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0))
        assertEquals(1, result.size)
        assertEquals(BigInteger.ONE, result[0])
    }

    @Test
    fun `encodeVoteBitmasks - option 2 yields 4`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(2))
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(4), result[0])
    }

    @Test
    fun `encodeVoteBitmasks - option 7 yields 128`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(7))
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(128), result[0])
    }

    @Test
    fun `encodeVoteBitmasks - multiple options yield separate bitmasks`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0, 2, 5))
        assertEquals(3, result.size)
        assertEquals(BigInteger.ONE, result[0])           // 1 << 0 = 1
        assertEquals(BigInteger.valueOf(4), result[1])     // 1 << 2 = 4
        assertEquals(BigInteger.valueOf(32), result[2])    // 1 << 5 = 32
    }

    @Test
    fun `encodeVoteBitmasks - empty list yields empty result`() {
        val result = CalldataEncoder.encodeVoteBitmasks(emptyList())
        assertTrue(result.isEmpty())
    }

    @Test
    fun `encodeVoteBitmasks - each result is power of 2`() {
        for (i in 0..15) {
            val result = CalldataEncoder.encodeVoteBitmasks(listOf(i))
            val expected = BigInteger.ONE.shiftLeft(i)
            assertEquals("Option $i should yield ${expected}", expected, result[0])
        }
    }

    @Test
    fun `encodeDateAsHex - Feb 22 2026`() {
        val result = CalldataEncoder.encodeDateAsHex(2026, 2, 22)
        // 26 -> 0x1a, 02 -> 0x02, 22 -> 0x16
        // hex: "1a0216"
        val expected = BigInteger("1a0216", 16)
        assertEquals(expected, result)
    }

    @Test
    fun `encodeDateAsHex - Jan 1 2024`() {
        val result = CalldataEncoder.encodeDateAsHex(2024, 1, 1)
        // 24 -> 0x18, 01 -> 0x01, 01 -> 0x01
        val expected = BigInteger("180101", 16)
        assertEquals(expected, result)
    }

    @Test
    fun `encodeDateAsHex - Dec 31 2099`() {
        val result = CalldataEncoder.encodeDateAsHex(2099, 12, 31)
        // 99 -> 0x63, 12 -> 0x0c, 31 -> 0x1f
        val expected = BigInteger("630c1f", 16)
        assertEquals(expected, result)
    }

    @Test
    fun `encodeUserPayload - produces non-empty result`() {
        val payload = CalldataEncoder.encodeUserPayload(
            proposalId = BigInteger.ONE,
            votes = listOf(BigInteger.valueOf(4)),
            nullifier = BigInteger.valueOf(12345),
            citizenship = BigInteger.valueOf(4804178), // "IRN" as bytes
            identityCreationTimestamp = BigInteger.valueOf(1700000000)
        )
        assertTrue("Payload should be non-empty", payload.isNotEmpty())
        // ABI encoding produces 32-byte aligned data
        assertEquals("Payload length should be 32-byte aligned", 0, payload.size % 32)
    }

    @Test
    fun `encodeUserPayload - different inputs produce different outputs`() {
        val payload1 = CalldataEncoder.encodeUserPayload(
            proposalId = BigInteger.ONE,
            votes = listOf(BigInteger.ONE),
            nullifier = BigInteger.valueOf(111),
            citizenship = BigInteger.valueOf(222),
            identityCreationTimestamp = BigInteger.valueOf(333)
        )
        val payload2 = CalldataEncoder.encodeUserPayload(
            proposalId = BigInteger.TWO,
            votes = listOf(BigInteger.ONE),
            nullifier = BigInteger.valueOf(111),
            citizenship = BigInteger.valueOf(222),
            identityCreationTimestamp = BigInteger.valueOf(333)
        )
        assertFalse("Different proposalIds should produce different payloads",
            payload1.contentEquals(payload2))
    }
}
