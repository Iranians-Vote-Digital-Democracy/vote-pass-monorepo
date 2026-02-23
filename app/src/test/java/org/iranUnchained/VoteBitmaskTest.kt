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

    // Single-select: produces single-element array with power-of-2 bitmask

    @Test
    fun `single option 0 of 4 - bitmask is 1`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0), 4)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ONE, result[0]) // 2^0 = 1
    }

    @Test
    fun `single option 1 of 2 - bitmask is 2`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(1), 2)
        assertEquals(1, result.size)
        assertEquals(BigInteger.TWO, result[0]) // 2^1 = 2
    }

    @Test
    fun `single option 2 of 4 - bitmask is 4`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(2), 4)
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(4), result[0]) // 2^2 = 4
    }

    @Test
    fun `single option 3 of 4 - bitmask is 8`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(3), 4)
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(8), result[0]) // 2^3 = 8
    }

    @Test
    fun `all single options produce power-of-2 bitmasks`() {
        for (i in 0..7) {
            val result = CalldataEncoder.encodeVoteBitmasks(listOf(i), 8)
            assertEquals(1, result.size)
            val expected = BigInteger.ONE.shiftLeft(i)
            assertEquals("Option $i", expected, result[0])
        }
    }

    // Multichoice: OR of selected bit positions

    @Test
    fun `multichoice - two adjacent options`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0, 1), 3)
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(3), result[0]) // 0b11 = 3
    }

    @Test
    fun `multichoice - three non-consecutive options`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0, 3, 7), 8)
        assertEquals(1, result.size)
        // bit 0 + bit 3 + bit 7 = 1 + 8 + 128 = 137
        assertEquals(BigInteger.valueOf(137), result[0])
    }

    @Test
    fun `multichoice - all 8 options selected`() {
        val options = (0..7).toList()
        val result = CalldataEncoder.encodeVoteBitmasks(options, 8)
        assertEquals(1, result.size)
        assertEquals(BigInteger.valueOf(255), result[0]) // 0xFF = all 8 bits set
    }

    // Boundary conditions

    @Test
    fun `empty selection yields zero bitmask`() {
        val result = CalldataEncoder.encodeVoteBitmasks(emptyList(), 3)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ZERO, result[0])
    }

    @Test
    fun `zero total options yields zero bitmask`() {
        val result = CalldataEncoder.encodeVoteBitmasks(emptyList(), 0)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ZERO, result[0])
    }

    @Test
    fun `option 0 of 1 is minimum valid choice`() {
        val result = CalldataEncoder.encodeVoteBitmasks(listOf(0), 1)
        assertEquals(1, result.size)
        assertEquals(BigInteger.ONE, result[0])
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
