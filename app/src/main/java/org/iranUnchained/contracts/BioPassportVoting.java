package org.iranUnchained.contracts;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.StaticStruct;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.StaticArray2;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.RemoteFunctionCall;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.Contract;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.ContractGasProvider;

@SuppressWarnings("rawtypes")
public class BioPassportVoting extends Contract {
    public static final String BINARY = "Bin file was not provided";

    public static final String FUNC_EXECUTE = "execute";
    public static final String FUNC_PROPOSALSSTATE = "proposalsState";
    public static final String FUNC_REGISTRATIONSMT = "registrationSMT";
    public static final String FUNC_VOTINGVERIFIER = "votingVerifier";

    @Deprecated
    protected BioPassportVoting(String contractAddress, Web3j web3j, Credentials credentials, BigInteger gasPrice, BigInteger gasLimit) {
        super(BINARY, contractAddress, web3j, credentials, gasPrice, gasLimit);
    }

    protected BioPassportVoting(String contractAddress, Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        super(BINARY, contractAddress, web3j, credentials, contractGasProvider);
    }

    @Deprecated
    protected BioPassportVoting(String contractAddress, Web3j web3j, TransactionManager transactionManager, BigInteger gasPrice, BigInteger gasLimit) {
        super(BINARY, contractAddress, web3j, transactionManager, gasPrice, gasLimit);
    }

    protected BioPassportVoting(String contractAddress, Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        super(BINARY, contractAddress, web3j, transactionManager, contractGasProvider);
    }

    public RemoteFunctionCall<TransactionReceipt> execute(byte[] registrationRoot, BigInteger currentDate,
            byte[] userPayload, ProofPoints zkPoints) {
        final Function function = new Function(FUNC_EXECUTE,
                Arrays.<Type>asList(new Bytes32(registrationRoot), new Uint256(currentDate),
                        new DynamicBytes(userPayload), zkPoints),
                Collections.<TypeReference<?>>emptyList());
        return executeRemoteCallTransaction(function);
    }

    public RemoteFunctionCall<String> proposalsState() {
        final Function function = new Function(FUNC_PROPOSALSSTATE,
                Arrays.<Type>asList(),
                Arrays.<TypeReference<?>>asList(new TypeReference<Address>() {}));
        return executeRemoteCallSingleValueReturn(function, String.class);
    }

    public RemoteFunctionCall<String> registrationSMT() {
        final Function function = new Function(FUNC_REGISTRATIONSMT,
                Arrays.<Type>asList(),
                Arrays.<TypeReference<?>>asList(new TypeReference<Address>() {}));
        return executeRemoteCallSingleValueReturn(function, String.class);
    }

    public RemoteFunctionCall<String> votingVerifier() {
        final Function function = new Function(FUNC_VOTINGVERIFIER,
                Arrays.<Type>asList(),
                Arrays.<TypeReference<?>>asList(new TypeReference<Address>() {}));
        return executeRemoteCallSingleValueReturn(function, String.class);
    }

    @Deprecated
    public static BioPassportVoting load(String contractAddress, Web3j web3j, Credentials credentials, BigInteger gasPrice, BigInteger gasLimit) {
        return new BioPassportVoting(contractAddress, web3j, credentials, gasPrice, gasLimit);
    }

    @Deprecated
    public static BioPassportVoting load(String contractAddress, Web3j web3j, TransactionManager transactionManager, BigInteger gasPrice, BigInteger gasLimit) {
        return new BioPassportVoting(contractAddress, web3j, transactionManager, gasPrice, gasLimit);
    }

    public static BioPassportVoting load(String contractAddress, Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        return new BioPassportVoting(contractAddress, web3j, credentials, contractGasProvider);
    }

    public static BioPassportVoting load(String contractAddress, Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        return new BioPassportVoting(contractAddress, web3j, transactionManager, contractGasProvider);
    }

    public static class ProofPoints extends StaticStruct {
        public BigInteger[] a;
        public BigInteger[][] b;
        public BigInteger[] c;

        public ProofPoints(BigInteger[] a, BigInteger[][] b, BigInteger[] c) {
            super(new StaticArray2<>(Uint256.class,
                            new Uint256(a[0]), new Uint256(a[1])),
                    new StaticArray2<>(StaticArray2.class,
                            new StaticArray2<>(Uint256.class, new Uint256(b[0][0]), new Uint256(b[0][1])),
                            new StaticArray2<>(Uint256.class, new Uint256(b[1][0]), new Uint256(b[1][1]))),
                    new StaticArray2<>(Uint256.class,
                            new Uint256(c[0]), new Uint256(c[1])));
            this.a = a;
            this.b = b;
            this.c = c;
        }
    }
}
