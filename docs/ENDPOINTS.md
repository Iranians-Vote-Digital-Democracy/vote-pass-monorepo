# Endpoint Reference

All Rarimo / FreedomTool endpoints used by the vote-pass platform, with health-check commands and current status.

## Quick Health Check

```bash
# Run all checks at once:
for url in \
  "https://rpc.evm.mainnet.rarimo.com" \
  "https://api.stage.freedomtool.org" \
  "https://kyc.iran.freedomtool.org" \
  "https://proofverification.iran.freedomtool.org" \
  "https://issuer.iran.freedomtool.org" \
  "https://rpcproxy.iran.freedomtool.org" \
  "https://rpc.evm.testnet.rarimo.com"; do
  printf "%-50s " "$url"
  curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" --connect-timeout 5 "$url"
done
```

## Production Endpoints (BaseConfig)

| Endpoint | URL | Check Command | Status (2026-02-23) |
|----------|-----|---------------|---------------------|
| Blockchain RPC | `https://rpcproxy.iran.freedomtool.org` | `curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' https://rpcproxy.iran.freedomtool.org` | DOWN (timeout) |
| KYC / Identity Provider | `https://kyc.iran.freedomtool.org` | `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://kyc.iran.freedomtool.org` | DOWN (timeout) |
| Proof Verification Relayer | `https://proofverification.iran.freedomtool.org` | `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://proofverification.iran.freedomtool.org` | DOWN (timeout) |
| Issuer | `https://issuer.iran.freedomtool.org` | `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://issuer.iran.freedomtool.org` | DOWN (timeout) |
| Rarimo Core RPC | `https://rpc-api.mainnet.rarimo.com` | `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://rpc-api.mainnet.rarimo.com` | Not checked |

**Note**: All `*.iran.freedomtool.org` services resolve to `34.165.29.23` and are unreachable (connection timeout).

### Contract Addresses (Production)

| Contract | Address |
|----------|---------|
| Registration | `0x90D6905362a9CBaF3A401a629a19057D23055Baf` |
| ProposalsState | `0xB1e1650A95e2baC47084D3E324766d3B16e5d0ef` |

## Staging / Testnet Endpoints (TestNet config)

| Endpoint | URL | Status (2026-02-23) |
|----------|-----|---------------------|
| API Gateway | `https://api.stage.freedomtool.org` | 503 (Service Unavailable) |
| Testnet RPC | `https://rpc.evm.testnet.rarimo.com` | DOWN (DNS failure) |
| Q Testnet RPC | `https://rpc.qtestnet.org` | Not checked |

### Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| Registration | `0xC97c08F18F03bF14c7013533A53fbCe934E5Cb1e` |
| ProposalsState | `0xb6407f0bb10fDC61863253e0ca36531Fc6D4aedE` |

## Rarimo Mainnet (Working)

| Endpoint | URL | Status (2026-02-23) |
|----------|-----|---------------------|
| EVM RPC | `https://rpc.evm.mainnet.rarimo.com` | UP (200, 0.27s) |
| Block Explorer | `https://evmscan.rarimo.com` | Not checked |

```bash
# Verify mainnet RPC:
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://rpc.evm.mainnet.rarimo.com
```

## Local Development (LocalDev config)

| Endpoint | URL | Notes |
|----------|-----|-------|
| Blockchain RPC | `http://10.0.2.2:8545` | Hardhat node (10.0.2.2 = host from Android emulator) |
| API Gateway | `http://10.0.2.2:8000` | Nginx gateway (Docker) |
| Registration Relayer | `http://10.0.2.2:8000/integrations/registration-relayer/v1/register` | Via gateway |
| Vote Relayer | `http://10.0.2.2:8000/integrations/proof-verification-relayer/v2/vote` | Via gateway |
| Auth Service | `http://10.0.2.2:8000/integrations/decentralized-auth-svc/v1/authorize` | Via gateway |

### Contract Addresses (Local - update after deploy)

| Contract | Address |
|----------|---------|
| Registration | `0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1` |
| ProposalsState | `0x6212cb549De37c25071cF506aB7E115D140D9e42` |

## Identity Provider Service (Self-Hosting)

The `passport-identity-provider` is NOT included in our docker-compose. Self-hosting requires 7+ services:

| Service | Port | Purpose |
|---------|------|---------|
| passport-identity-provider | 8003 | Passport verification + credential issuance |
| issuer-node API | 3001 | Core Polygon ID issuer |
| issuer-node API-UI | 3002 | Issuer admin interface |
| PostgreSQL (issuer) | 5432 | Issuer database |
| PostgreSQL (IDP) | 35432 | Identity provider database |
| Redis | 6379 | Issuer cache |
| HashiCorp Vault | 8200 | Key management + DID storage |

See Phase 7 in the implementation plan for full self-hosting setup instructions.

## Recommendations

1. **For local E2E testing**: Use Hardhat node + mock contracts (RegistrationSMTMock, VerifierMock). No external services needed.
2. **For mainnet deployment**: Only `rpc.evm.mainnet.rarimo.com` is currently working. All other production services need to be self-hosted or restored.
3. **For staging**: The staging gateway returns 503 — likely needs Rarimo team to restore.
