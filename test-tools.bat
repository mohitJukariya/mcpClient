@echo off
echo Testing New MCP Tools
echo ====================

:: Test 1: Multi Balance
echo.
echo Test 1: Multi Balance
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\": \"Check ETH balances for 0x6492772d1474ffa1ed6944e86735848c253bb007 and 0xDb16dE5985a83e6b2B13b63dA73cC59FEf4Ec05a\"}" --max-time 15

:: Test 2: ERC20 Transfers
echo.
echo.
echo Test 2: ERC20 Transfers
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\": \"Show me ERC20 token transfers for 0x6492772d1474ffa1ed6944e86735848c253bb007\"}" --max-time 15

:: Test 3: Address Type
echo.
echo.
echo Test 3: Address Type
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\": \"Is 0x6492772d1474ffa1ed6944e86735848c253bb007 a contract or wallet?\"}" --max-time 15

:: Test 4: Gas Oracle
echo.
echo.
echo Test 4: Gas Oracle
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\": \"What are the current gas price recommendations?\"}" --max-time 15

echo.
echo.
echo Testing complete!
