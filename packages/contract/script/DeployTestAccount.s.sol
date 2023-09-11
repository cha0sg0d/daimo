// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/DaimoAccountFactory.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // From DeployAccountFactory.s.sol
        AccountFactory factory = AccountFactory(
            0x692A2E6eA43A1fAB2f9f68393F5cB5dcaf9C67B9
        );

        // hardcoded from swift playground
        bytes32[2] memory key = [
            bytes32(
                hex"65a2fa44daad46eab0278703edb6c4dcf5e30b8a9aec09fdc71a56f52aa392e4"
            ),
            bytes32(
                hex"4a7a9e4604aa36898209997288e902ac544a555e4b5e0a9efef2b59233f3f437"
            )
        ];

        Call[] memory calls = new Call[](0);

        factory.createAccount(0, key, calls, 0);

        vm.stopBroadcast();
    }

    // Exclude from forge coverage
    function test() public {}
}
