// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/CertificateRegistry.sol";

contract CertificateRegistryTest is Test {
    CertificateRegistry public registry;
    address public owner = address(1);
    address public admin = address(2);
    address public student = address(3);

    bytes32 constant HASH_A = keccak256("cert1");
    bytes32 constant HASH_B = keccak256("cert2");
    bytes32 constant HASH_C = keccak256("nonexistent");

    function setUp() public {
        vm.prank(owner);
        registry = new CertificateRegistry();
        vm.prank(owner);
        registry.addAdmin(admin);
    }

    function test_IssueCertificate() public {
        vm.prank(admin);
        registry.issueCertificate(
            "Sameer Dhakal",
            "BCT-2078-045",
            "Blockchain Engineering",
            "A+",
            HASH_A,
            "ipfs123"
        );

        (
            string memory name,
            string memory regNo,
            ,
            ,
            bytes32 certHash,
            ,
            uint256 issuedAt,
            address issuer,
            bool revoked
        ) = registry.certificates(HASH_A);

        assertEq(name, "Sameer Dhakal");
        assertEq(regNo, "BCT-2078-045");
        assertEq(certHash, HASH_A);
        assertEq(issuedAt, block.timestamp);
        assertEq(issuer, admin);
        assertFalse(revoked);
    }

    function test_VerifyCertificate() public {
        vm.prank(admin);
        registry.issueCertificate(
            "Sameer Dhakal",
            "BCT-2078-045",
            "Blockchain Engineering",
            "A+",
            HASH_A,
            "ipfs123"
        );

        assertTrue(registry.verifyCertificate(HASH_A));
    }

    function test_Revert_VerifyNonExistent() public {
        vm.expectRevert("Not found");
        registry.verifyCertificate(HASH_C);
    }

    function test_RevokeCertificate() public {
        vm.prank(admin);
        registry.issueCertificate(
            "Sameer Dhakal",
            "BCT-2078-045",
            "Blockchain Engineering",
            "A+",
            HASH_A,
            "ipfs123"
        );

        vm.prank(admin);
        registry.revokeCertificate(HASH_A);

        (,,,,,,,, bool revoked) = registry.certificates(HASH_A);
        assertTrue(revoked);
    }

    function test_Revert_IssueDuplicate() public {
        vm.prank(admin);
        registry.issueCertificate("N1", "R1", "C1", "G1", HASH_A, "I1");

        vm.expectRevert("Exists");
        vm.prank(admin);
        registry.issueCertificate("N1", "R1", "C1", "G1", HASH_A, "I1");
    }
}
