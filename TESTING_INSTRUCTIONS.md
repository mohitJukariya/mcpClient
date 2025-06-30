## MANUAL TESTING INSTRUCTIONS

### Step 1: Start the Server
Open a terminal and run:
```bash
npm run start:dev
```

### Step 2: Test Tool Calling
Open another terminal and run one of these test commands:

**PowerShell Test:**
```powershell
$body = @{
    message = "what is the current gas price"
    personalityId = "alice"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/chat" -Method Post -Body $body -ContentType "application/json"
```

**Curl Test:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"what is the current gas price","personalityId":"alice"}'
```

### Step 3: Check Debug Output
Look at the server console for these debug messages:
- `🔧 SYSTEM PROMPT BEING SENT:` - Shows what instructions the LLM receives
- `🤖 RAW LLM RESPONSE:` - Shows what the LLM actually generates
- `logging original content before cleanup:` - Shows content before cleaning
- `final cleaned response:` - Shows final response

### Step 4: Analyze Results
Check if:
1. **System prompt** contains tool instructions
2. **Raw response** contains `TOOL_CALL:` text
3. **Tool extraction** finds any tool calls
4. **Final response** shows tool data or made-up data

### Expected Working Response:
If tools work correctly, you should see:
- Raw response: `TOOL_CALL:getGasPrice:{}`
- Tools used: 1
- Final response: Actual gas price data

### Current Problem:
If tools don't work, you'll see:
- Raw response: "The current gas price is X gwei" (made up)
- Tools used: 0
- Final response: Made-up data

This will help us identify exactly where the tool calling breaks down!
