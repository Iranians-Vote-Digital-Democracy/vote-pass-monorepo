package org.iranUnchained

import org.iranUnchained.utils.CalldataEncoder
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class CalldataEncoderTest {

    @Test
    fun `encodeVoteBitmasks - select option 0 of 2 produces bitmask 1`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0), 2)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ONE, result[0]) // 2^0 = 1
    }

    @Test
    fun `encodeVoteBitmasks - select option 1 of 3 produces bitmask 2`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(1), 3)
        assertEquals(1, result.size)
        assertEquals(BigInteger.TWO, result[0]) // 2^1 = 2
    }

    @Test
    fun `encodeVoteBitmasks - multi-select options 0 and 2 of 3 produces bitmask 5`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0, 2), 3)
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(5), result[0]) // 2^0 + 2^2 = 1 + 4 = 5
    }

    @Test
    fun `encodeVoteBitmasks - empty selection produces bitmask 0`() {
        val result = CalldataEncoder.encodeVoteBitmasks(emptyList(), 3)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ZERO, result[0])
    }

    @Test
    fun `encodeVoteBitmasks - zero total options produces bitmask 0`() {
        val result = CalldataEncoder.encodeVoteBitmasks(emptyList(), 0)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ZERO, result[0])
    }

    @Test
    fun `encodeDateAsAsciiBytes - Feb 23 2026`() {
        val result = CalldataEncoder.encodeDateAsAsciiBytes(2026, 2, 23)
        // "260223" as ASCII: [0x32,0x36,0x30,0x32,0x32,0x33]
        val expected = BigInteger("323630323233", 16)
        assertEquals(expected, result)
    }

    @Test
    fun `encodeDateAsAsciiBytes - Jan 1 2024`() {
        val result = CalldataEncoder.encodeDateAsAsciiBytes(2024, 1, 1)
        // "240101" as ASCII: [0x32,0x34,0x30,0x31,0x30,0x31]
        val expected = BigInteger("323430313031", 16)
        assertEquals(expected, result)
    }

    @Test
    fun `encodeDateAsAsciiBytes - Dec 31 2099`() {
        val result = CalldataEncoder.encodeDateAsAsciiBytes(2099, 12, 31)
        // "991231" as ASCII: [0x39,0x39,0x31,0x32,0x33,0x31]
        val expected = BigInteger("393931323331", 16)
        assertEquals(expected, result)
    }

    @Test
    fun `encodeUserPayload - produces non-empty result`() {
        val payload = CalldataEncoder.encodeUserPayload(
            proposalId = BigInteger.ONE,
            votes = listOf(BigInteger.ONE),
            nullifier = BigInteger.valueOf(12345),
            citizenship = BigInteger.valueOf(4804178), // "IRN" as bytes
            identityCreationTimestamp = BigInteger.valueOf(1700000000)
        )
        assertTrue("Payload should be non-empty", payload.isNotEmpty())
        // ABI encoding produces 32-byte aligned data
        assertEquals("Payload length should be 32-byte aligned", 0, payload.size % 32)
    }

    @Test
    fun `encodeUserPayload - exact ABI encoding matches Solidity abi_encode`() {
        // Solidity: abi.encode(uint256 proposalId, uint256[] vote, UserData(nullifier, citizenship, timestamp))
        // Tuple layout: (uint256, uint256[], (uint256, uint256, uint256))
        //   word 0: proposalId (static)
        //   word 1: offset to uint256[] (dynamic) = 0xa0 = 160 (head size: 32+32+96)
        //   words 2-4: UserData inline (static struct: nullifier, citizenship, timestamp)
        //   word 5: array length
        //   word 6+: array elements
        val payload = CalldataEncoder.encodeUserPayload(
            proposalId = BigInteger.ONE,
            votes = listOf(BigInteger.valueOf(4)), // bit 2 = Infrastructure
            nullifier = BigInteger.valueOf(100),
            citizenship = BigInteger.valueOf(200),
            identityCreationTimestamp = BigInteger.valueOf(300)
        )
        val hex = payload.joinToString("") { "%02x".format(it) }

        // 7 words = 224 bytes = 448 hex chars (no 0x20 prefix)
        println("encodeUserPayload hex (${hex.length / 2} bytes, ${hex.length / 64} words):")
        for (i in hex.indices step 64) {
            val word = hex.substring(i, minOf(i + 64, hex.length))
            println("  word ${i / 64}: $word")
        }

        // Verify: first word should be proposalId=1 (no 0x20 prefix from web3j)
        val word0 = hex.substring(0, 64)
        val firstValue = BigInteger(word0, 16)
        println("First word value: $firstValue (expected: 1 for proposalId, 32 if web3j adds 0x20 prefix)")

        assertEquals("First word should be proposalId=1 (no web3j prefix)",
            BigInteger.ONE, firstValue)

        // Verify: second word should be offset to dynamic array = 0xa0 = 160
        val word1 = hex.substring(64, 128)
        val offsetValue = BigInteger(word1, 16)
        println("Second word (offset): $offsetValue (expected: 160)")
        assertEquals("Offset to vote array should be 160", BigInteger.valueOf(160), offsetValue)

        // Verify: words 2-4 should be UserData (nullifier=100, citizenship=200, timestamp=300)
        val nullifierVal = BigInteger(hex.substring(128, 192), 16)
        val citizenshipVal = BigInteger(hex.substring(192, 256), 16)
        val timestampVal = BigInteger(hex.substring(256, 320), 16)
        println("UserData: nullifier=$nullifierVal, citizenship=$citizenshipVal, timestamp=$timestampVal")
        assertEquals("nullifier", BigInteger.valueOf(100), nullifierVal)
        assertEquals("citizenship", BigInteger.valueOf(200), citizenshipVal)
        assertEquals("timestamp", BigInteger.valueOf(300), timestampVal)

        // Verify: word 5 should be array length = 1
        val arrayLen = BigInteger(hex.substring(320, 384), 16)
        assertEquals("array length", BigInteger.ONE, arrayLen)

        // Verify: word 6 should be vote[0] = 4
        val voteVal = BigInteger(hex.substring(384, 448), 16)
        assertEquals("vote[0] should be 4 (bit 2)", BigInteger.valueOf(4), voteVal)

        // Total: exactly 7 words = 224 bytes
        assertEquals("Total payload should be 224 bytes", 224, payload.size)
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
