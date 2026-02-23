package org.iranUnchained.utils

import org.iranUnchained.data.models.Proof
import org.web3j.abi.DefaultFunctionEncoder
import org.web3j.abi.TypeEncoder
import org.web3j.abi.datatypes.DynamicArray
import org.web3j.abi.datatypes.DynamicBytes
import org.web3j.abi.datatypes.DynamicStruct
import org.web3j.abi.datatypes.StaticStruct
import org.web3j.abi.datatypes.generated.Bytes32
import org.web3j.abi.datatypes.generated.StaticArray2
import org.web3j.abi.datatypes.generated.Uint256
import org.web3j.utils.Numeric
import java.math.BigInteger

object CalldataEncoder {

    /**
     * Encode vote choices as bitmasks.
     * For single-select: selectedOptions = [2] → [4] (1 << 2)
     * For multi-select: selectedOptions = [0, 2] → [1, 4]
     */
    fun encodeVoteBitmasks(selectedOptions: List<Int>): List<BigInteger> {
        return selectedOptions.map { optionIndex ->
            BigInteger.ONE.shiftLeft(optionIndex)
        }
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
     */
    fun encodeExecuteCalldata(
        registrationRoot: ByteArray,
        currentDate: BigInteger,
        userPayload: ByteArray,
        proof: Proof
    ): String {
        // Method selector for execute(bytes32,uint256,bytes,(uint256[2],uint256[2][2],uint256[2]))
        val methodId = "0x2853da2c"

        val proofPoints = buildProofPointsStruct(proof)

        val encoder = DefaultFunctionEncoder()
        val function = org.web3j.abi.datatypes.Function(
            "execute",
            listOf(
                Bytes32(registrationRoot),
                Uint256(currentDate),
                DynamicBytes(userPayload),
                proofPoints
            ),
            emptyList()
        )

        return "0x" + encoder.encodeFunction(function)
    }

    private fun buildProofPointsStruct(proof: Proof): StaticStruct {
        val a = StaticArray2(Uint256::class.java,
            Uint256(BigInteger(proof.pi_a[0])),
            Uint256(BigInteger(proof.pi_a[1]))
        )

        val b0 = StaticArray2(Uint256::class.java,
            Uint256(BigInteger(proof.pi_b[0][0])),
            Uint256(BigInteger(proof.pi_b[0][1]))
        )
        val b1 = StaticArray2(Uint256::class.java,
            Uint256(BigInteger(proof.pi_b[1][0])),
            Uint256(BigInteger(proof.pi_b[1][1]))
        )
        val b = StaticArray2(StaticArray2::class.java, b0, b1)

        val c = StaticArray2(Uint256::class.java,
            Uint256(BigInteger(proof.pi_c[0])),
            Uint256(BigInteger(proof.pi_c[1]))
        )

        return StaticStruct(a, b, c)
    }

    /**
     * Encode current date as yyMMdd hex format used by the contract.
     * E.g., 2026-02-22 → 0x260222
     */
    fun encodeDateAsHex(year: Int, month: Int, day: Int): BigInteger {
        val yy = year % 100
        val hex = String.format("%02x%02x%02x", yy, month, day)
        return BigInteger(hex, 16)
    }
}
