// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ICertificateRegistry {
    function verifyCertificate(bytes32 _certificateHash) external view returns (bool);
}

contract Sameer is ERC721, Ownable {

    uint256 private _tokenId;

    address public registryAddress;

    mapping(uint256 => bytes32) public certificateHash;
    mapping(bytes32 => bool) public minted;

    constructor(address initialOwner, address _registry)
        ERC721("Certificate Badge", "CBADGE")
        Ownable(initialOwner)
    {
        registryAddress = _registry;
    }

    function mintCertificateNFT(
        address student,
        bytes32 certHash
    ) external onlyOwner returns (uint256) {

        require(!minted[certHash], "Already minted");

        require(
            ICertificateRegistry(registryAddress).verifyCertificate(certHash),
            "Certificate not valid in registry"
        );

        uint256 tokenId = _tokenId++;

        _safeMint(student, tokenId);

        certificateHash[tokenId] = certHash;
        minted[certHash] = true;

        return tokenId;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        require(from == address(0), "Soulbound NFT: non-transferable");
        return super._update(to, tokenId, auth);
    }
}
