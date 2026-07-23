// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/CertificateRegistry.sol";
import "../src/Sameer.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CertificateRegistry registry = new CertificateRegistry();
        Sameer nft = new Sameer(vm.addr(deployerPrivateKey), address(registry));

        vm.stopBroadcast();

        console.log("Registry deployed at:", address(registry));
        console.log("Sameer NFT deployed at:", address(nft));
    }
}
