// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title VerifierMock
 * @notice Mock verifier supporting both Circom (Groth16) and Noir (UltraPlonk) proofs.
 * Always returns true for testing purposes.
 */
contract VerifierMock {
    // Circom/Groth16 verification
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[23] calldata
    ) public pure returns (bool) {
        return true;
    }

    // Noir/UltraPlonk verification (INoirVerifier interface)
    function verify(
        bytes calldata,
        bytes32[] calldata
    ) public pure returns (bool) {
        return true;
    }

    function getVerificationKeyHash() public pure returns (bytes32) {
        return bytes32(0);
    }
}
