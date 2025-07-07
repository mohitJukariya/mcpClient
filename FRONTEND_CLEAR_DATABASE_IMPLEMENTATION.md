# Frontend Implementation: Clear Neo4j Database Button

## Overview
Add a "Clear Database" button to the frontend that allows users to clear all Neo4j graph database data with proper confirmation and feedback.

## Backend API Endpoint (Already Implemented)

**Endpoint:** `DELETE /api/context/database/clear`

**Response Format:**
```typescript
{
  success: boolean;
  message: string;
  stats?: {
    nodesRemoved: number;
    relationshipsRemoved: number;
  };
  timestamp: string;
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Database cleared successfully. Removed 32 nodes and 35 relationships.",
  "stats": {
    "nodesRemoved": 32,
    "relationshipsRemoved": 35
  },
  "timestamp": "2025-07-07T21:56:11.123Z"
}
```

## Frontend Implementation Requirements

### 1. Button Component
Create a prominent but safely styled button (red/warning colors) with:
- Clear warning text: "Clear Database" or "Reset Memory"
- Warning icon (⚠️ or 🗑️)
- Disabled state while operation is in progress
- Loading spinner during operation

### 2. Confirmation Dialog
Before making the API call, show a confirmation dialog with:
- **Title:** "Clear Database Confirmation"
- **Message:** "This will permanently delete all stored conversation history, user contexts, and relationship data. This action cannot be undone. Are you sure?"
- **Buttons:** 
  - "Cancel" (default/focused)
  - "Yes, Clear Database" (red/destructive style)

### 3. API Integration
```typescript
// Example API function
const clearDatabase = async (): Promise<{
  success: boolean;
  message: string;
  stats?: { nodesRemoved: number; relationshipsRemoved: number };
}> => {
  const response = await fetch('/api/context/database/clear', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
};
```

### 4. Success/Error Feedback
After the operation:

**Success:**
- Show success toast/notification: "Database cleared successfully! Removed X nodes and Y relationships."
- Optionally refresh the page or reset relevant UI state
- Clear any cached conversation data in frontend state

**Error:**
- Show error toast/notification: "Failed to clear database: [error message]"
- Re-enable the button
- Log error for debugging

### 5. UI/UX Guidelines

**Button Placement:**
- Settings/Admin section
- Developer tools area
- Or a dedicated "Memory Management" section

**Styling:**
```css
.clear-database-btn {
  background-color: #dc3545; /* Red */
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-database-btn:hover {
  background-color: #c82333;
}

.clear-database-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
```

### 6. Component Example (React/Vue/etc.)

**React Example:**
```tsx
import { useState } from 'react';

const ClearDatabaseButton = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      const result = await clearDatabase();
      if (result.success) {
        // Show success notification
        alert(`Success! ${result.message}`);
        // Optionally refresh page or reset state
        window.location.reload();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      alert(`Failed to clear database: ${error.message}`);
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        className="clear-database-btn"
        onClick={() => setShowConfirm(true)}
        disabled={isClearing}
      >
        {isClearing ? '🔄' : '🗑️'} 
        {isClearing ? 'Clearing...' : 'Clear Database'}
      </button>

      {showConfirm && (
        <div className="confirm-dialog">
          <div className="confirm-content">
            <h3>⚠️ Clear Database Confirmation</h3>
            <p>This will permanently delete all stored conversation history, user contexts, and relationship data. This action cannot be undone.</p>
            <p><strong>Are you sure?</strong></p>
            <div className="confirm-buttons">
              <button onClick={() => setShowConfirm(false)}>Cancel</button>
              <button 
                onClick={handleClearDatabase}
                className="confirm-destroy"
                disabled={isClearing}
              >
                Yes, Clear Database
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
```

### 7. Testing
Test the following scenarios:
1. **Successful clear** - Verify success message and stats
2. **Network error** - Handle connection failures gracefully
3. **Server error** - Handle 4xx/5xx responses
4. **Cancel confirmation** - Ensure dialog closes without action
5. **Disabled state** - Button should be disabled during operation

### 8. Additional Features (Optional)
- **Clear confirmation with typing:** Require user to type "CLEAR" to confirm
- **Progress indicator:** Show percentage or steps during clear operation
- **Backup warning:** Remind user about creating backups
- **Selective clear:** Options to clear only specific data types (future enhancement)

## Security Note
Consider adding additional authentication/authorization for this destructive operation in production environments.

## API Base URL
Make sure to use the correct base URL for your environment:
- Development: `http://localhost:3000/api`
- Production: `[Your production URL]/api`
