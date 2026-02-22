# Testing Guide for Iranians.Vote

Adapted from [Moloch Testing Philosophy](https://github.com/MolochVentures/moloch/blob/master/test/README.md) and extended for ZK circuits, mobile app, and backend services.

> "A hypothesis is worth nothing if you are not also willing to notice evidence against it."

The quality of tests is just as important as the code itself. For a voting platform handling sensitive identity data, comprehensive testing is not optional—it's essential for security and correctness.

---

## Core Principles

### 1. Don't Repeat Yourself (DRY)

After initial tests pass, refactor common setup and verification into reusable functions:

```typescript
// BAD - repeated setup
it('should register identity', async () => {
  const smt = await deploySMT();
  const stateKeeper = await deployStateKeeper(smt.address);
  const registration = await deployRegistration(stateKeeper.address);
  // ... test logic
});

it('should reject duplicate identity', async () => {
  const smt = await deploySMT();
  const stateKeeper = await deployStateKeeper(smt.address);
  const registration = await deployRegistration(stateKeeper.address);
  // ... test logic
});

// GOOD - shared setup
describe('Registration', () => {
  let fixtures: RegistrationFixtures;

  beforeEach(async () => {
    fixtures = await deployRegistrationFixtures();
  });

  it('should register identity', async () => { /* ... */ });
  it('should reject duplicate identity', async () => { /* ... */ });
});
```

This emphasizes differences between tests, making them easier to review and reason about.

### 2. Verification Functions

Create dedicated verification functions for each operation that checks ALL expected state transitions:

```typescript
// For smart contracts
async function verifyRegistration(
  registration: Registration2,
  stateKeeper: StateKeeper,
  identityKey: bigint,
  expectedRoot: string
) {
  // Verify identity is registered
  const identity = await stateKeeper.getIdentityInfo(identityKey);
  expect(identity.activePassport).to.not.equal(0);

  // Verify SMT root updated
  const currentRoot = await registration.getRegistrationRoot();
  expect(currentRoot).to.equal(expectedRoot);

  // Verify event emitted
  // ... etc
}

// For circuits
function verifyCircuitOutput(
  witness: WitnessMap,
  expectedNullifier: bigint,
  expectedCommitment: bigint
) {
  expect(witness.get('nullifier')).to.equal(expectedNullifier);
  expect(witness.get('commitment')).to.equal(expectedCommitment);
}
```

### 3. Snapshot & Revert (Contracts)

Use EVM snapshots for test isolation and speed:

```typescript
import { Reverter } from './helpers/reverter';

describe('Voting', () => {
  const reverter = new Reverter();

  before(async () => {
    // Deploy contracts once
    await deployAll();
    await reverter.snapshot();
  });

  afterEach(async () => {
    await reverter.revert();
  });
});
```

### 4. Trigger Every Require/Assert

**Every `require` statement must have a corresponding test that triggers it.**

This ensures:
- No obsolete checks exist
- All failure modes are documented
- Edge cases are explicitly covered

```solidity
// Contract code
function vote(uint256 proposalId, bytes calldata proof) external {
  require(proposalId < proposals.length, "Invalid proposal");      // Test 1
  require(!hasVoted[msg.sender][proposalId], "Already voted");     // Test 2
  require(block.timestamp < proposals[proposalId].endTime, "Voting ended"); // Test 3
  // ...
}
```

```typescript
// Tests
it('should revert with "Invalid proposal" for non-existent proposal', async () => {
  await expect(voting.vote(999, proof))
    .to.be.revertedWith("Invalid proposal");
});

it('should revert with "Already voted" on double vote attempt', async () => {
  await voting.vote(0, proof);
  await expect(voting.vote(0, proof))
    .to.be.revertedWith("Already voted");
});

it('should revert with "Voting ended" after deadline', async () => {
  await time.increase(VOTING_DURATION + 1);
  await expect(voting.vote(0, proof))
    .to.be.revertedWith("Voting ended");
});
```

### 5. Test All Modifiers

Verify that access control modifiers are properly applied:

```typescript
describe('Access Control', () => {
  it('should reject non-owner calling admin function', async () => {
    await expect(contract.connect(attacker).adminFunction())
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it('should allow owner to call admin function', async () => {
    await expect(contract.connect(owner).adminFunction())
      .to.not.be.reverted;
  });
});
```

### 6. Boundary Condition Testing

Test edge values systematically:

| Value | Test Case |
|-------|-----------|
| `0` | Zero/empty input handling |
| `1` | Minimum valid value |
| `MAX - 1` | Just under maximum |
| `MAX` | Maximum value (should often fail) |
| `MAX + 1` | Overflow handling |

```typescript
describe('Boundary Conditions', () => {
  it('should handle zero amount', async () => { /* ... */ });
  it('should handle minimum valid amount (1)', async () => { /* ... */ });
  it('should accept MAX_UINT256 - 1', async () => { /* ... */ });
  it('should reject MAX_UINT256', async () => { /* ... */ });
});
```

### 7. 100% Code Path Coverage

Every branch of conditional logic needs explicit testing:

```solidity
// For this code:
if (a && b) {
  // path 1
} else {
  // path 2
}
```

You need 4 tests:
1. `a=true, b=true` → path 1
2. `a=true, b=false` → path 2
3. `a=false, b=true` → path 2
4. `a=false, b=false` → path 2

### 8. Logical Test Organization

Structure tests following usage flow:

```typescript
describe('Registration', () => {
  describe('Happy Path', () => {
    it('should register new identity with valid proof');
    it('should emit IdentityRegistered event');
    it('should update SMT root');
  });

  describe('Validation Errors', () => {
    it('should reject invalid proof');
    it('should reject expired certificate');
    it('should reject duplicate identity');
  });

  describe('Access Control', () => {
    it('should reject unauthorized relayer');
  });

  describe('Boundary Conditions', () => {
    it('should handle maximum identity key value');
  });

  describe('Edge Cases', () => {
    it('should handle reissuance after revocation');
  });
});
```

---

## Testing by Component Type

### Smart Contract Tests

**Location**: `platform/services/passport-voting-contracts/test/`

**Framework**: Hardhat + Chai + ethers.js

**Key Patterns**:
```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('NoirIDVoting', () => {
  async function deployFixture() {
    const [owner, voter, attacker] = await ethers.getSigners();
    // Deploy contracts...
    return { voting, owner, voter, attacker };
  }

  it('should verify and record vote', async () => {
    const { voting, voter } = await loadFixture(deployFixture);
    // Test implementation
  });
});
```

**What to Test**:
- State transitions (before/after comparisons)
- Event emissions
- Revert conditions with exact messages
- Gas consumption for critical paths
- Upgrade safety (for proxies)

### ZK Circuit Tests

**Location**: `mobile-Iranians.vote/__tests__/circuits/`

**Key Patterns**:
```typescript
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';

describe('INID Registration Circuit', () => {
  let circuit: Noir;
  let backend: BarretenbergBackend;

  before(async () => {
    const circuitArtifact = await loadCircuit('register/inid');
    backend = new BarretenbergBackend(circuitArtifact);
    circuit = new Noir(circuitArtifact, backend);
  });

  describe('Happy Path', () => {
    it('should generate valid proof for valid NID data', async () => {
      const inputs = loadTestNIDData();
      const { witness } = await circuit.execute(inputs);
      const proof = await backend.generateProof(witness);
      const verified = await backend.verifyProof(proof);
      expect(verified).to.be.true;
    });
  });

  describe('Invalid Inputs', () => {
    it('should fail for tampered certificate', async () => {
      const inputs = loadTestNIDData();
      inputs.certificate[0] ^= 0xFF; // Tamper
      await expect(circuit.execute(inputs)).to.be.rejected;
    });
  });
});
```

**What to Test**:
- Proof generation succeeds for valid inputs
- Proof verification succeeds
- Circuit rejects invalid/tampered inputs
- Public outputs match expected values
- Nullifier uniqueness
- Commitment correctness

### Mobile App Tests

**Location**: `mobile-Iranians.vote/__tests__/`

**Framework**: Jest + React Native Testing Library

**Key Patterns**:
```typescript
// Unit test for NFC reader
describe('INIDNFCReader', () => {
  it('should parse MAV4 certificate correctly', () => {
    const rawData = loadTestCertificateData();
    const result = parseMAV4Certificate(rawData);
    expect(result.serialNumber).toBeDefined();
    expect(result.publicKey).toHaveLength(65);
  });
});

// Integration test for registration flow
describe('NoirEIDRegistration', () => {
  it('should build valid registration call data', async () => {
    const mockEID = createMockEID();
    const registration = new NoirEIDRegistration();
    const callData = await registration.buildRegisterCallData(mockEID);
    expect(callData).toMatch(/^0x/);
  });
});
```

**What to Test**:
- NFC data parsing
- Certificate extraction
- Proof generation integration
- API call formatting
- Error handling and user feedback
- State management

### Backend Service Tests

**Location**: `platform/services/*/test/`

**What to Test**:
- API endpoint validation
- Transaction submission
- Rate limiting
- Error responses
- Gas estimation

---

## Test Data Management

### Mocked Data

Use realistic but synthetic test data for most tests:

```typescript
// test/fixtures/mock-nid.ts
export const MOCK_NID_CERTIFICATE = {
  serialNumber: '123456789',
  publicKey: Buffer.from('04' + '00'.repeat(64), 'hex'),
  signature: Buffer.alloc(64),
  // ... other fields
};

export function createMockEID(overrides?: Partial<EID>): EID {
  return {
    ...MOCK_NID_CERTIFICATE,
    ...overrides,
  };
}
```

### Real Test Data

For integration tests with actual NID data:

1. **Storage**: Place in `testdata/` directory (gitignored)
2. **Loading**: Use environment variables for paths
3. **Security**: Never log raw certificate data in CI

```typescript
// Only load if available
const realNIDPath = process.env.TEST_NID_DATA_PATH;
const realNIDData = realNIDPath ? loadSecureTestData(realNIDPath) : null;

describe('Real NID Integration', () => {
  before(function() {
    if (!realNIDData) {
      this.skip(); // Skip if no real data available
    }
  });

  it('should verify real NID certificate chain', async () => {
    // Test with real data
  });
});
```

---

## Test Checklist Template

For every new feature or bug fix, complete this checklist:

```markdown
## Test Checklist for [Feature Name]

### Unit Tests
- [ ] Happy path - basic functionality works
- [ ] Input validation - all invalid inputs rejected
- [ ] Boundary conditions - 0, 1, MAX-1, MAX tested
- [ ] Error messages - exact revert strings verified

### Integration Tests
- [ ] End-to-end flow works
- [ ] Cross-component interactions verified
- [ ] State consistency maintained

### Security Tests
- [ ] Access control enforced
- [ ] No reentrancy vulnerabilities
- [ ] No overflow/underflow issues
- [ ] ZK soundness maintained (for circuits)

### Edge Cases
- [ ] Empty/null inputs handled
- [ ] Concurrent operations safe
- [ ] Recovery from failures works
```

---

## Running Tests

### Smart Contracts
```bash
cd platform/services/passport-voting-contracts
yarn test                    # Run all tests
yarn test:coverage          # With coverage report
yarn test test/voting/      # Specific directory
```

### Mobile App
```bash
cd mobile-Iranians.vote
yarn test                   # Run all tests
yarn test --watch          # Watch mode
yarn test --coverage       # Coverage report
yarn test __tests__/circuits/  # Specific tests
```

### CI Integration

Tests must pass before merge:
- All unit tests green
- Coverage thresholds met (aim for >80%)
- No security warnings
- Linting passes
