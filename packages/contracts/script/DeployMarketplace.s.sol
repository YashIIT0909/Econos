// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/WorkerRegistry.sol";
import "../src/NativeEscrow.sol";


contract DeployCronos is Script {
    function run() external {
        // 1. Load the deployer private key from .env
        // Make sure your .env has PRIVATE_KEY=0x... (without quotes)
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // 2. Deploy WorkerRegistry
        WorkerRegistry registry = new WorkerRegistry();
        console.log("--------------------------------------------------");
        console.log("WorkerRegistry deployed at:", address(registry));

        // 3. Deploy NativeEscrow
        // Pass the Registry address to the constructor
        NativeEscrow escrow = new NativeEscrow(address(registry));
        console.log("NativeEscrow deployed at:  ", address(escrow));

        // 4. CRITICAL: Link Registry to Escrow
        // We must authorize the Escrow contract to call slashReputation()
        registry.setEscrowContract(address(escrow));
        console.log("Registry linked to Escrow (Slashing Authorized)");
        console.log("--------------------------------------------------");

        vm.stopBroadcast();
    }
}