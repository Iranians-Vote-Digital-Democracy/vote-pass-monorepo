package org.iranUnchained

import org.iranUnchained.data.models.RequirementsForVoting
import org.iranUnchained.data.models.OptionsData
import org.iranUnchained.data.models.ProposalData
import org.iranUnchained.data.models.ProposalStatus
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class VoteEligibilityTest {

    // Citizenship codes from PassportHelper
    private val IRN_CODE = 7490194L
    private val UKR_CODE = 4903594L
    private val RUS_CODE = 13281866L
    private val GEO_CODE = 15901410L

    private fun createProposal(
        citizenshipWhitelist: List<Long> = emptyList(),
        status: ProposalStatus = ProposalStatus.Started,
        startTimestamp: Long = 1700000000,
        endTimestamp: Long = 1700100000,
    ) = ProposalData(
        proposalId = 1,
        title = "Test",
        description = "Test",
        options = listOf(OptionsData("Yes", 0), OptionsData("No", 1)),
        startTimestamp = startTimestamp,
        endTimestamp = endTimestamp,
        status = status,
        votingResults = listOf(listOf(0, 0, 0, 0, 0, 0, 0, 0)),
        multichoice = 0,
        votingContractAddress = "0x1234",
        proposalSMTAddress = "0x5678",
        citizenshipWhitelist = citizenshipWhitelist
    )

    private fun createRequirements(
        nationalityCodes: List<Long> = emptyList(),
        age: Int? = null
    ) = RequirementsForVoting(
        nationality = nationalityCodes.map { BigInteger.valueOf(it) },
        age = age
    )

    // Citizenship validation tests

    @Test
    fun `empty whitelist - getNationality returns null`() {
        val req = createRequirements(nationalityCodes = emptyList())
        assertNull(req.getNationality())
    }

    @Test
    fun `single nationality in whitelist - getNationality returns country code`() {
        val req = createRequirements(nationalityCodes = listOf(IRN_CODE))
        assertEquals("IRN", req.getNationality())
    }

    @Test
    fun `multiple nationalities in whitelist - getNationality returns comma-separated`() {
        val req = createRequirements(nationalityCodes = listOf(IRN_CODE, UKR_CODE))
        assertEquals("IRN, UKR", req.getNationality())
    }

    @Test
    fun `isInList - user nationality is in whitelist`() {
        val req = createRequirements(nationalityCodes = listOf(IRN_CODE, UKR_CODE))
        assertTrue(req.isInList("IRN"))
    }

    @Test
    fun `isInList - user nationality is NOT in whitelist`() {
        val req = createRequirements(nationalityCodes = listOf(IRN_CODE, UKR_CODE))
        assertFalse(req.isInList("GEO"))
    }

    @Test
    fun `isInList - empty whitelist means no match`() {
        val req = createRequirements(nationalityCodes = emptyList())
        assertFalse(req.isInList("IRN"))
    }

    @Test
    fun `isInList - unknown code maps to empty string`() {
        val req = createRequirements(nationalityCodes = listOf(999999L))
        assertFalse(req.isInList("IRN"))
        assertTrue(req.isInList(""))
    }

    // Age requirement tests

    @Test
    fun `age requirement - null means no age restriction`() {
        val req = createRequirements(age = null)
        assertNull(req.age)
    }

    @Test
    fun `age requirement - specified age value`() {
        val req = createRequirements(age = 18)
        assertEquals(18, req.age)
    }

    @Test
    fun `age requirement - zero is valid`() {
        val req = createRequirements(age = 0)
        assertEquals(0, req.age)
    }

    // Proposal status / timing tests

    @Test
    fun `proposal with Started status is active`() {
        val proposal = createProposal(status = ProposalStatus.Started)
        assertTrue(proposal.isActive)
        assertFalse(proposal.isEnded)
    }

    @Test
    fun `proposal with Ended status is ended`() {
        val proposal = createProposal(status = ProposalStatus.Ended)
        assertFalse(proposal.isActive)
        assertTrue(proposal.isEnded)
    }

    @Test
    fun `proposal with Waiting status is neither active nor ended`() {
        val proposal = createProposal(status = ProposalStatus.Waiting)
        assertFalse(proposal.isActive)
        assertFalse(proposal.isEnded)
    }

    @Test
    fun `proposal with None status is neither active nor ended`() {
        val proposal = createProposal(status = ProposalStatus.None)
        assertFalse(proposal.isActive)
        assertFalse(proposal.isEnded)
    }

    @Test
    fun `proposal with DoNotShow status is neither active nor ended`() {
        val proposal = createProposal(status = ProposalStatus.DoNotShow)
        assertFalse(proposal.isActive)
        assertFalse(proposal.isEnded)
    }

    // toVotingData citizenship mapping tests

    @Test
    fun `toVotingData - empty citizenship whitelist maps to empty requirements`() {
        val proposal = createProposal(citizenshipWhitelist = emptyList())
        val votingData = proposal.toVotingData()
        assertTrue(votingData.requirements?.nationality?.isEmpty() == true)
        assertNull(votingData.requirements?.getNationality())
    }

    @Test
    fun `toVotingData - citizenship whitelist maps to BigInteger list`() {
        val proposal = createProposal(citizenshipWhitelist = listOf(IRN_CODE, UKR_CODE))
        val votingData = proposal.toVotingData()
        assertEquals(2, votingData.requirements?.nationality?.size)
        assertEquals(BigInteger.valueOf(IRN_CODE), votingData.requirements?.nationality?.get(0))
        assertEquals(BigInteger.valueOf(UKR_CODE), votingData.requirements?.nationality?.get(1))
    }

    @Test
    fun `toVotingData - isPassportRequired is always true`() {
        val votingData = createProposal().toVotingData()
        assertTrue(votingData.isPassportRequired)
    }

    @Test
    fun `toVotingData - active proposal maps isActive true`() {
        val votingData = createProposal(status = ProposalStatus.Started).toVotingData()
        assertTrue(votingData.isActive)
    }

    @Test
    fun `toVotingData - ended proposal maps isActive false`() {
        val votingData = createProposal(status = ProposalStatus.Ended).toVotingData()
        assertFalse(votingData.isActive)
    }
}
