package org.iranUnchained.contracts;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Callable;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.DynamicArray;
import org.web3j.abi.datatypes.DynamicBytes;
import org.web3j.abi.datatypes.DynamicStruct;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.StaticArray;
import org.web3j.abi.datatypes.StaticStruct;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.StaticArray8;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.RemoteFunctionCall;
import org.web3j.tx.Contract;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.ContractGasProvider;

@SuppressWarnings("rawtypes")
public class ProposalsState extends Contract {
    public static final String BINARY = "Bin file was not provided";

    public static final String FUNC_LASTPROPOSALID = "lastProposalId";
    public static final String FUNC_GETPROPOSALINFO = "getProposalInfo";
    public static final String FUNC_GETPROPOSALCONFIG = "getProposalConfig";
    public static final String FUNC_GETPROPOSALSTATUS = "getProposalStatus";
    public static final String FUNC_GETPROPOSALEVENTID = "getProposalEventId";

    @Deprecated
    protected ProposalsState(String contractAddress, Web3j web3j, Credentials credentials, BigInteger gasPrice, BigInteger gasLimit) {
        super(BINARY, contractAddress, web3j, credentials, gasPrice, gasLimit);
    }

    protected ProposalsState(String contractAddress, Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        super(BINARY, contractAddress, web3j, credentials, contractGasProvider);
    }

    @Deprecated
    protected ProposalsState(String contractAddress, Web3j web3j, TransactionManager transactionManager, BigInteger gasPrice, BigInteger gasLimit) {
        super(BINARY, contractAddress, web3j, transactionManager, gasPrice, gasLimit);
    }

    protected ProposalsState(String contractAddress, Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        super(BINARY, contractAddress, web3j, transactionManager, contractGasProvider);
    }

    public RemoteFunctionCall<BigInteger> lastProposalId() {
        final Function function = new Function(FUNC_LASTPROPOSALID,
                Arrays.<Type>asList(),
                Arrays.<TypeReference<?>>asList(new TypeReference<Uint256>() {}));
        return executeRemoteCallSingleValueReturn(function, BigInteger.class);
    }

    public RemoteFunctionCall<ProposalInfo> getProposalInfo(BigInteger proposalId) {
        final Function function = new Function(FUNC_GETPROPOSALINFO,
                Arrays.<Type>asList(new Uint256(proposalId)),
                Arrays.<TypeReference<?>>asList(new TypeReference<ProposalInfo>() {}));
        return executeRemoteCallSingleValueReturn(function, ProposalInfo.class);
    }

    public RemoteFunctionCall<ProposalConfig> getProposalConfig(BigInteger proposalId) {
        final Function function = new Function(FUNC_GETPROPOSALCONFIG,
                Arrays.<Type>asList(new Uint256(proposalId)),
                Arrays.<TypeReference<?>>asList(new TypeReference<ProposalConfig>() {}));
        return executeRemoteCallSingleValueReturn(function, ProposalConfig.class);
    }

    public RemoteFunctionCall<BigInteger> getProposalStatus(BigInteger proposalId) {
        final Function function = new Function(FUNC_GETPROPOSALSTATUS,
                Arrays.<Type>asList(new Uint256(proposalId)),
                Arrays.<TypeReference<?>>asList(new TypeReference<Uint8>() {}));
        return executeRemoteCallSingleValueReturn(function, BigInteger.class);
    }

    public RemoteFunctionCall<BigInteger> getProposalEventId(BigInteger proposalId) {
        final Function function = new Function(FUNC_GETPROPOSALEVENTID,
                Arrays.<Type>asList(new Uint256(proposalId)),
                Arrays.<TypeReference<?>>asList(new TypeReference<Uint256>() {}));
        return executeRemoteCallSingleValueReturn(function, BigInteger.class);
    }

    @Deprecated
    public static ProposalsState load(String contractAddress, Web3j web3j, Credentials credentials, BigInteger gasPrice, BigInteger gasLimit) {
        return new ProposalsState(contractAddress, web3j, credentials, gasPrice, gasLimit);
    }

    @Deprecated
    public static ProposalsState load(String contractAddress, Web3j web3j, TransactionManager transactionManager, BigInteger gasPrice, BigInteger gasLimit) {
        return new ProposalsState(contractAddress, web3j, transactionManager, gasPrice, gasLimit);
    }

    public static ProposalsState load(String contractAddress, Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        return new ProposalsState(contractAddress, web3j, credentials, contractGasProvider);
    }

    public static ProposalsState load(String contractAddress, Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        return new ProposalsState(contractAddress, web3j, transactionManager, contractGasProvider);
    }

    public static class ProposalConfig extends DynamicStruct {
        public BigInteger startTimestamp;
        public BigInteger duration;
        public BigInteger multichoice;
        public List<BigInteger> acceptedOptions;
        public String description;
        public List<String> votingWhitelist;
        public List<byte[]> votingWhitelistData;

        public ProposalConfig(BigInteger startTimestamp, BigInteger duration, BigInteger multichoice,
                              List<BigInteger> acceptedOptions, String description,
                              List<String> votingWhitelist, List<byte[]> votingWhitelistData) {
            super(new Uint64(startTimestamp), new Uint64(duration), new Uint256(multichoice),
                    new DynamicArray<>(Uint256.class, toUint256List(acceptedOptions)),
                    new Utf8String(description),
                    new DynamicArray<>(Address.class, toAddressList(votingWhitelist)),
                    new DynamicArray<>(DynamicBytes.class, toDynamicBytesList(votingWhitelistData)));
            this.startTimestamp = startTimestamp;
            this.duration = duration;
            this.multichoice = multichoice;
            this.acceptedOptions = acceptedOptions;
            this.description = description;
            this.votingWhitelist = votingWhitelist;
            this.votingWhitelistData = votingWhitelistData;
        }

        public ProposalConfig(Uint64 startTimestamp, Uint64 duration, Uint256 multichoice,
                              DynamicArray<Uint256> acceptedOptions, Utf8String description,
                              DynamicArray<Address> votingWhitelist, DynamicArray<DynamicBytes> votingWhitelistData) {
            super(startTimestamp, duration, multichoice, acceptedOptions, description,
                    votingWhitelist, votingWhitelistData);
            this.startTimestamp = startTimestamp.getValue();
            this.duration = duration.getValue();
            this.multichoice = multichoice.getValue();
            this.acceptedOptions = fromUint256List(acceptedOptions.getValue());
            this.description = description.getValue();
            this.votingWhitelist = fromAddressList(votingWhitelist.getValue());
            this.votingWhitelistData = fromDynamicBytesList(votingWhitelistData.getValue());
        }
    }

    public static class ProposalInfo extends DynamicStruct {
        public String proposalSMT;
        public BigInteger status;
        public ProposalConfig config;
        public List<List<BigInteger>> votingResults;

        public ProposalInfo(String proposalSMT, BigInteger status, ProposalConfig config,
                            List<List<BigInteger>> votingResults) {
            super(new Address(proposalSMT), new Uint8(status), config,
                    new DynamicArray<>(StaticArray8.class));
            this.proposalSMT = proposalSMT;
            this.status = status;
            this.config = config;
            this.votingResults = votingResults;
        }

        public ProposalInfo(Address proposalSMT, Uint8 status, ProposalConfig config,
                            DynamicArray<StaticArray8<Uint256>> votingResults) {
            super(proposalSMT, status, config, votingResults);
            this.proposalSMT = proposalSMT.getValue();
            this.status = status.getValue();
            this.config = config;
            this.votingResults = fromStaticArray8List(votingResults.getValue());
        }
    }

    // Helper methods for type conversion
    private static List<Uint256> toUint256List(List<BigInteger> values) {
        Uint256[] arr = new Uint256[values.size()];
        for (int i = 0; i < values.size(); i++) {
            arr[i] = new Uint256(values.get(i));
        }
        return Arrays.asList(arr);
    }

    private static List<BigInteger> fromUint256List(List<Uint256> values) {
        BigInteger[] arr = new BigInteger[values.size()];
        for (int i = 0; i < values.size(); i++) {
            arr[i] = values.get(i).getValue();
        }
        return Arrays.asList(arr);
    }

    private static List<Address> toAddressList(List<String> values) {
        Address[] arr = new Address[values.size()];
        for (int i = 0; i < values.size(); i++) {
            arr[i] = new Address(values.get(i));
        }
        return Arrays.asList(arr);
    }

    private static List<String> fromAddressList(List<Address> values) {
        String[] arr = new String[values.size()];
        for (int i = 0; i < values.size(); i++) {
            arr[i] = values.get(i).getValue();
        }
        return Arrays.asList(arr);
    }

    private static List<DynamicBytes> toDynamicBytesList(List<byte[]> values) {
        DynamicBytes[] arr = new DynamicBytes[values.size()];
        for (int i = 0; i < values.size(); i++) {
            arr[i] = new DynamicBytes(values.get(i));
        }
        return Arrays.asList(arr);
    }

    private static List<byte[]> fromDynamicBytesList(List<DynamicBytes> values) {
        byte[][] arr = new byte[values.size()][];
        for (int i = 0; i < values.size(); i++) {
            arr[i] = values.get(i).getValue();
        }
        return Arrays.asList(arr);
    }

    private static List<List<BigInteger>> fromStaticArray8List(List<StaticArray8<Uint256>> arrays) {
        BigInteger[][] result = new BigInteger[arrays.size()][];
        for (int i = 0; i < arrays.size(); i++) {
            StaticArray8<Uint256> arr = arrays.get(i);
            List<Uint256> values = arr.getValue();
            result[i] = new BigInteger[values.size()];
            for (int j = 0; j < values.size(); j++) {
                result[i][j] = values.get(j).getValue();
            }
        }
        List<List<BigInteger>> outer = new java.util.ArrayList<>();
        for (BigInteger[] inner : result) {
            outer.add(Arrays.asList(inner));
        }
        return outer;
    }
}
