package org.iranUnchained.utils

import org.iranUnchained.data.models.Proof
import org.web3j.abi.TypeEncoder
import org.web3j.abi.datatypes.DynamicArray
import org.web3j.abi.datatypes.DynamicStruct
import org.web3j.abi.datatypes.StaticStruct
import org.web3j.abi.datatypes.generated.Uint256
import org.web3j.utils.Numeric
import java.math.BigInteger
import java.util.Locale

object CalldataEncoder {

    /**
     * Encode vote choices as a single-element bitmask array for the contract.
     *
     * The contract's acceptedOptions is per-question-group, not per-display-option.
     * For a single-question proposal with N choices, acceptedOptions = [(1 << N) - 1].
     * The vote is [1 << selectedOptionIndex] for single-select,
     * or [OR of all selected bits] for multi-select.
     *
     * For single-select (option 0 of 3): [1]    (bit 0 = 0b001)
     * For single-select (option 1 of 3): [2]    (bit 1 = 0b010)
     * For single-select (option 2 of 3): [4]    (bit 2 = 0b100)
     * For multi-select (options 0 and 2): [5]   (bits 0+2 = 0b101)
     */
    fun encodeVoteBitmasks(selectedOptions: List<Int>, totalOptions: Int): List<BigInteger> {
        var bitmask = BigInteger.ZERO
        for (optionIndex in selectedOptions) {
            bitmask = bitmask.or(BigInteger.ONE.shiftLeft(optionIndex))
        }
        return listOf(bitmask)
    }

    /**
     * Encode the userPayload bytes for execute().
     * Format: abi.encode(uint256 proposalId, uint256[] vote, (uint256 nullifier, uint256 citizenship, uint256 identityCreationTimestamp) userData)
     */
    fun encodeUserPayload(
        proposalId: BigInteger,
        votes: List<BigInteger>,
        nullifier: BigInteger,
        citizenship: BigInteger,
        identityCreationTimestamp: BigInteger
    ): ByteArray {
        val userData = StaticStruct(
            Uint256(nullifier),
            Uint256(citizenship),
            Uint256(identityCreationTimestamp)
        )

        val voteArray = DynamicArray(Uint256::class.java,
            votes.map { Uint256(it) }
        )

        val encoded = DynamicStruct(
            Uint256(proposalId),
            voteArray,
            userData
        )

        val encodedHex = TypeEncoder.encode(encoded)
        return Numeric.hexStringToByteArray(encodedHex)
    }

    /**
     * Encode the full execute() calldata.
     * Method signature: execute(bytes32,uint256,bytes,(uint256[2],uint256[2][2],uint256[2]))
     * Selector: 0xe4ab0833 (keccak256 of canonical signature)
     *
     * Manual ABI encoding because web3j 4.8 produces incorrect calldata for
     * functions with StaticStruct containing nested StaticArray2 types.
     *
     * Layout:
     *   [selector 4B]
     *   [bytes32 registrationRoot: 32B inline]
     *   [uint256 currentDate: 32B inline]
     *   [uint256 offset to bytes: 32B → points past ProofPoints]
     *   [ProofPoints: 8 × 32B = 256B inline (pi_a[2], pi_b[2][2], pi_c[2])]
     *   [uint256 bytes length: 32B]
     *   [bytes data: padded to 32B boundary]
     */
    fun encodeExecuteCalldata(
        registrationRoot: ByteArray,
        currentDate: BigInteger,
        userPayload: ByteArray,
        proof: Proof
    ): String {
        val sb = StringBuilder()
        sb.append("0xe4ab0833")

        // Param 1: bytes32 registrationRoot (inline)
        sb.append(padLeft(Numeric.toHexStringNoPrefix(registrationRoot), 64))

        // Param 2: uint256 currentDate (inline)
        sb.append(padLeft(currentDate.toString(16), 64))

        // Param 3: offset to dynamic bytes data
        // Head size = 32 (bytes32) + 32 (uint256) + 32 (offset) + 256 (ProofPoints) = 352 = 0x160
        sb.append(padLeft("160", 64))

        // Param 4: ProofPoints inline (8 uint256 values)
        sb.append(padLeft(BigInteger(proof.pi_a[0]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_a[1]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_b[0][0]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_b[0][1]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_b[1][0]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_b[1][1]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_c[0]).toString(16), 64))
        sb.append(padLeft(BigInteger(proof.pi_c[1]).toString(16), 64))

        // Dynamic section: bytes userPayload
        sb.append(padLeft(userPayload.size.toString(16), 64))
        sb.append(Numeric.toHexStringNoPrefix(userPayload))
        // Pad to 32-byte boundary
        val remainder = userPayload.size % 32
        if (remainder != 0) {
            sb.append("0".repeat((32 - remainder) * 2))
        }

        return sb.toString()
    }

    private fun padLeft(hex: String, totalChars: Int): String {
        return hex.padStart(totalChars, '0')
    }

    /**
     * Encode current date as 6 ASCII bytes (YYMMDD) packed into uint256.
     * The contract's Date2Time.timestampFromDate() reads each byte as ASCII,
     * subtracts 48 ('0'), and interprets as 2-digit year + month + day.
     *
     * E.g., 2026-02-23 → "260223" → [0x32,0x36,0x30,0x32,0x32,0x33] → 0x323630323233
     */
    fun encodeDateAsAsciiBytes(year: Int, month: Int, day: Int): BigInteger {
        val yy = year % 100
        val dateStr = String.format(Locale.US, "%02d%02d%02d", yy, month, day)
        val bytes = dateStr.toByteArray(Charsets.US_ASCII)
        return BigInteger(1, bytes)
    }
}
