package org.iranUnchained

import org.iranUnchained.data.models.OptionsData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.ProposalStatus
import org.iranUnchained.utils.CalldataEncoder
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class VoteBitmaskTest {

    private fun createProposal(
        multichoice: Long = 0,
        optionCount: Int = 4
    ) = ProposalData(
        proposalId = 1,
        title = "Test",
        description = "Test",
        options = (0 until optionCount).map { OptionsData("Option $it", it) },
        startTimestamp = 1700000000,
        endTimestamp = 1700100000,
        status = ProposalStatus.Started,
        votingResults = (0 until optionCount).map { listOf(0L, 0, 0, 0, 0, 0, 0, 0) },
        multichoice = multichoice,
        votingContractAddress = "0x1234",
        proposalSMTAddress = "0x5678",
        citizenshipWhitelist = emptyList()
    )

    // Single-select: each result is a power of 2

    @Test
    fun `single option 0 encodes to 1`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0))
        assertEquals(1, result.size)
        assertEquals(BigInteger.ONE, result[0])
    }

    @Test
    fun `single option 1 encodes to 2`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(1))
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(2), result[0])
    }

    @Test
    fun `single option 3 encodes to 8`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(3))
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(8), result[0])
    }

    @Test
    fun `all single options 0-7 are powers of 2`() {
        for (i in 0..7) {
            val result = CalldataEncoder.encodeVoteBitmasks(listOf(i))
            assertEquals(1, result.size)
            val expected = BigInteger.ONE.shiftLeft(i)
            assertEquals("Option $i should be 2^$i = $expected", expected, result[0])
        }
    }

    // Multichoice: any combination

    @Test
    fun `multichoice - two options produce two bitmasks`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0, 1))
        assertEquals(2, result.size)
        assertEquals(BigInteger.ONE, result[0])
        assertEquals(BigInteger.valueOf(2), result[1])
    }

    @Test
    fun `multichoice - three non-consecutive options`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0, 3, 7))
        assertEquals(3, result.size)
        assertEquals(BigInteger.ONE, result[0])         // 1 << 0 = 1
        assertEquals(BigInteger.valueOf(8), result[1])   // 1 << 3 = 8
        assertEquals(BigInteger.valueOf(128), result[2]) // 1 << 7 = 128
    }

    @Test
    fun `multichoice - all 8 options selected`() {
        val options = (0..7).toList()
        val result = CalldataEncoder.encodeVoteBitmasks(options)
        assertEquals(8, result.size)
        options.forEachIndexed { idx, opt ->
            assertEquals(BigInteger.ONE.shiftLeft(opt), result[idx])
        }
    }

    // Boundary conditions

    @Test
    fun `empty list yields empty result`() {
        val result = CalldataEncoder.encodeVoteBitmasks(emptyList())
        assertTrue(result.isEmpty())
    }

    @Test
    fun `option 0 is minimum valid choice`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0))
        assertEquals(BigInteger.ONE, result[0])
    }

    @Test
    fun `option 15 encodes to 32768`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(15))
        assertEquals(BigInteger.valueOf(32768), result[0])
    }

    @Test
    fun `option 31 encodes to 2^31`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(31))
        assertEquals(BigInteger.ONE.shiftLeft(31), result[0])
    }

    @Test
    fun `large option index 255 produces valid power of 2`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(255))
        assertEquals(1, result.size)
        assertEquals(BigInteger.ONE.shiftLeft(255), result[0])
    }

    // isMultichoice bitmask tests

    @Test
    fun `multichoice bitmask 0 - all questions are single-select`() {
        val proposal = createProposal(multichoice = 0)
        for (i in 0..7) {
            assertFalse("Question $i should be single-select", proposal.isMultichoice(i))
        }
    }

    @Test
    fun `multichoice bitmask 1 - only question 0 is multichoice`() {
        val proposal = createProposal(multichoice = 1) // binary: 1
        assertTrue(proposal.isMultichoice(0))
        assertFalse(proposal.isMultichoice(1))
        assertFalse(proposal.isMultichoice(2))
    }

    @Test
    fun `multichoice bitmask 2 - only question 1 is multichoice`() {
        val proposal = createProposal(multichoice = 2) // binary: 10
        assertFalse(proposal.isMultichoice(0))
        assertTrue(proposal.isMultichoice(1))
        assertFalse(proposal.isMultichoice(2))
    }

    @Test
    fun `multichoice bitmask 3 - questions 0 and 1 are multichoice`() {
        val proposal = createProposal(multichoice = 3) // binary: 11
        assertTrue(proposal.isMultichoice(0))
        assertTrue(proposal.isMultichoice(1))
        assertFalse(proposal.isMultichoice(2))
    }

    @Test
    fun `multichoice bitmask 5 - questions 0 and 2 are multichoice`() {
        val proposal = createProposal(multichoice = 5) // binary: 101
        assertTrue(proposal.isMultichoice(0))
        assertFalse(proposal.isMultichoice(1))
        assertTrue(proposal.isMultichoice(2))
    }

    @Test
    fun `multichoice bitmask 255 - all 8 questions are multichoice`() {
        val proposal = createProposal(multichoice = 255) // binary: 11111111
        for (i in 0..7) {
            assertTrue("Question $i should be multichoice", proposal.isMultichoice(i))
        }
    }

    @Test
    fun `multichoice bitmask - high bit index`() {
        val proposal = createProposal(multichoice = 1L shl 15) // bit 15 set
        assertFalse(proposal.isMultichoice(0))
        assertFalse(proposal.isMultichoice(14))
        assertTrue(proposal.isMultichoice(15))
        assertFalse(proposal.isMultichoice(16))
    }
}
