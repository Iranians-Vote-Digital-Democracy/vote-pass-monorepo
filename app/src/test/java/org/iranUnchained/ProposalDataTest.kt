package org.iranUnchained

import org.iranUnchained.data.models.OptionsData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.ProposalStatus
import org.junit.Assert.*
import org.junit.Test

class ProposalDataTest {

    private fun createProposal(
        proposalId: Long = 1,
        status: ProposalStatus = ProposalStatus.Started,
        startTimestamp: Long = 1700000000,
        endTimestamp: Long = 1700100000,
        votingResults: List<List<Long>> = listOf(listOf(10, 0, 0, 0, 0, 0, 0, 0), listOf(5, 0, 0, 0, 0, 0, 0, 0)),
        multichoice: Long = 0,
        citizenshipWhitelist: List<Long> = emptyList()
    ) = ProposalData(
        proposalId = proposalId,
        title = "Test Proposal",
        description = "A test proposal",
        options = listOf(OptionsData("Yes", 0), OptionsData("No", 1)),
        startTimestamp = startTimestamp,
        endTimestamp = endTimestamp,
        status = status,
        votingResults = votingResults,
        multichoice = multichoice,
        votingContractAddress = "0x1234",
        proposalSMTAddress = "0x5678",
        citizenshipWhitelist = citizenshipWhitelist
    )

    // Status tests
    @Test
    fun `ProposalStatus fromValue - valid values`() {
        assertEquals(ProposalStatus.None, ProposalStatus.fromValue(0))
        assertEquals(ProposalStatus.Waiting, ProposalStatus.fromValue(1))
        assertEquals(ProposalStatus.Started, ProposalStatus.fromValue(2))
        assertEquals(ProposalStatus.Ended, ProposalStatus.fromValue(3))
        assertEquals(ProposalStatus.DoNotShow, ProposalStatus.fromValue(4))
    }

    @Test
    fun `ProposalStatus fromValue - invalid value defaults to None`() {
        assertEquals(ProposalStatus.None, ProposalStatus.fromValue(99))
        assertEquals(ProposalStatus.None, ProposalStatus.fromValue(-1))
    }

    @Test
    fun `isActive returns true only for Started`() {
        assertTrue(createProposal(status = ProposalStatus.Started).isActive)
        assertFalse(createProposal(status = ProposalStatus.Ended).isActive)
        assertFalse(createProposal(status = ProposalStatus.Waiting).isActive)
        assertFalse(createProposal(status = ProposalStatus.None).isActive)
        assertFalse(createProposal(status = ProposalStatus.DoNotShow).isActive)
    }

    @Test
    fun `isEnded returns true only for Ended`() {
        assertTrue(createProposal(status = ProposalStatus.Ended).isEnded)
        assertFalse(createProposal(status = ProposalStatus.Started).isEnded)
        assertFalse(createProposal(status = ProposalStatus.Waiting).isEnded)
    }

    // totalVotes tests
    @Test
    fun `totalVotes - sums all vote counts`() {
        val results = listOf(
            listOf(10L, 0, 0, 0, 0, 0, 0, 0),
            listOf(5L, 0, 0, 0, 0, 0, 0, 0)
        )
        assertEquals(15L, createProposal(votingResults = results).totalVotes())
    }

    @Test
    fun `totalVotes - empty results return 0`() {
        assertEquals(0L, createProposal(votingResults = emptyList()).totalVotes())
    }

    @Test
    fun `totalVotes - all zeros return 0`() {
        val results = listOf(
            listOf(0L, 0, 0, 0, 0, 0, 0, 0),
            listOf(0L, 0, 0, 0, 0, 0, 0, 0)
        )
        assertEquals(0L, createProposal(votingResults = results).totalVotes())
    }

    // multichoice tests
    @Test
    fun `isMultichoice - bitmask 0 means all single-select`() {
        val proposal = createProposal(multichoice = 0)
        assertFalse(proposal.isMultichoice(0))
        assertFalse(proposal.isMultichoice(1))
        assertFalse(proposal.isMultichoice(2))
    }

    @Test
    fun `isMultichoice - bitmask 1 means first question is multichoice`() {
        val proposal = createProposal(multichoice = 1)
        assertTrue(proposal.isMultichoice(0))
        assertFalse(proposal.isMultichoice(1))
    }

    @Test
    fun `isMultichoice - bitmask 5 means questions 0 and 2 are multichoice`() {
        val proposal = createProposal(multichoice = 5) // binary 101
        assertTrue(proposal.isMultichoice(0))
        assertFalse(proposal.isMultichoice(1))
        assertTrue(proposal.isMultichoice(2))
    }

    // toVotingData tests
    @Test
    fun `toVotingData - maps fields correctly`() {
        val proposal = createProposal()
        val votingData = proposal.toVotingData()

        assertEquals("Test Proposal", votingData.header)
        assertEquals("A test proposal", votingData.description)
        assertEquals(1700100000L, votingData.dueDate)
        assertEquals(1700000000L, votingData.startDate)
        assertEquals("0x1234", votingData.contractAddress)
        assertTrue(votingData.isPassportRequired)
        assertTrue(votingData.isActive)
    }

    @Test
    fun `toVotingData - empty citizenship whitelist`() {
        val proposal = createProposal(citizenshipWhitelist = emptyList())
        val votingData = proposal.toVotingData()

        assertTrue(votingData.requirements?.nationality?.isEmpty() == true)
    }
}
