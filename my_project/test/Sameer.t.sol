// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/Sameer.sol";
import "../src/CertificateRegistry.sol";

contract SameerTest is Test {

    CertificateRegistry registry;
    Sameer nft;

    address user = address(1);
    bytes32 constant HASH_A = keccak256("cert1");
    bytes32 constant HASH_B = keccak256("wrong_hash");

    function setUp() public {
        registry = new CertificateRegistry();

        registry.issueCertificate(
            "Sameer",
            "REG123",
            "Blockchain",
            "A+",
            HASH_A,
            "ipfs://"
        );

        nft = new Sameer(address(this), address(registry));
    }

    function testMintNFT() public {
        nft.mintCertificateNFT(user, HASH_A);
        assertEq(nft.ownerOf(0), user);
    }

    function test_RevertInvalidHash() public {
        vm.expectRevert("Not found");
        nft.mintCertificateNFT(user, HASH_B);
    }
}
