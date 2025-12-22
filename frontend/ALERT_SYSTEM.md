# Modern Alert System

A beautiful, customizable alert and notification system that replaces native browser alerts with modern, user-friendly modals and toasts.

## Features

- ✨ Beautiful animated modals
- 🎨 Multiple alert types (success, error, warning, info, confirm)
- 📝 Input prompts with textarea support
- 🍞 Toast notifications
- 🎯 Promise-based API
- 📱 Fully responsive
- 🌙 Dark mode support
- ⚡ Zero dependencies

## Usage

### 1. Alert Messages

Display a simple alert message:

```javascript
// Basic alert
await showAlert('Operation completed successfully!', 'success');

// With custom title
await showAlert('Your changes have been saved', 'success', 'Success!');

// Different types
await showAlert('Something went wrong', 'error');
await showAlert('Please review your input', 'warning');
await showAlert('New features available', 'info');
```

### 2. Confirmation Dialogs

Get user confirmation before performing an action:

```javascript
// Basic confirmation
const confirmed = await showConfirm('Are you sure you want to delete this item?');
if (confirmed) {
    // User clicked "Confirm"
    deleteItem();
}

// With options
const confirmed = await showConfirm(
    'This action cannot be undone. Continue?',
    {
        title: 'Delete Property',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        danger: true  // Makes confirm button red
    }
);

// Success confirmation
const approved = await showConfirm(
    'Are you sure you want to approve this agent?',
    {
        title: 'Approve Agent',
        confirmText: 'Approve',
        type: 'success'
    }
);
```

### 3. Prompt Dialogs

Get text input from users:

```javascript
// Basic prompt
const username = await showPrompt('Please enter your username:');
if (username) {
    console.log('Username:', username);
}

// With options
const reason = await showPrompt(
    'Enter reason for suspension:',
    {
        title: 'Suspension Reason',
        inputType: 'textarea',
        placeholder: 'Provide a detailed reason...',
        defaultValue: '',
        confirmText: 'Submit',
        cancelText: 'Cancel'
    }
);

// Different input types
const email = await showPrompt('Enter your email:', {
    inputType: 'email',
    placeholder: 'you@example.com'
});

const password = await showPrompt('Enter password:', {
    inputType: 'password'
});
```

### 4. Toast Notifications

Display non-blocking notifications:

```javascript
// Basic toast
showToast('Property saved successfully!', 'success');

// With options
showToast('Failed to load data', 'error', {
    title: 'Error',
    duration: 5000  // Show for 5 seconds
});

// Different types
showToast('Profile updated', 'success');
showToast('Connection failed', 'error');
showToast('Please verify your email', 'warning');
showToast('You have 3 new messages', 'info');

// Persistent toast (no auto-dismiss)
showToast('Upload in progress...', 'info', { duration: 0 });
```

## Alert Types

### Success
- Green color scheme
- Checkmark icon
- Use for: Successful operations, confirmations, approvals

### Error
- Red color scheme
- X icon
- Use for: Failed operations, validation errors, critical issues

### Warning
- Orange/amber color scheme
- Warning triangle icon
- Use for: Cautionary messages, important notices

### Info
- Blue color scheme
- Information icon
- Use for: General information, tips, neutral messages

### Confirm
- Purple/indigo color scheme
- Question mark icon
- Use for: User confirmations, important decisions

## Advanced Options

### Confirmation Options
```javascript
{
    title: 'Dialog Title',        // Custom title
    confirmText: 'Yes, proceed',  // Custom confirm button text
    cancelText: 'No, cancel',     // Custom cancel button text
    type: 'confirm',              // Alert type
    danger: false                 // Make confirm button red
}
```

### Prompt Options
```javascript
{
    title: 'Input Required',      // Custom title
    defaultValue: '',             // Pre-filled value
    placeholder: 'Enter text...',  // Placeholder text
    inputType: 'text',            // Input type: text, email, password, textarea
    confirmText: 'Submit',        // Custom confirm button text
    cancelText: 'Cancel'          // Custom cancel button text
}
```

### Toast Options
```javascript
{
    title: 'Toast Title',         // Optional title
    duration: 4000                // Duration in ms (0 = no auto-dismiss)
}
```

## Integration

### Replace Native Alerts

**Before:**
```javascript
alert('Operation completed!');
if (confirm('Are you sure?')) {
    // do something
}
const name = prompt('Enter your name:');
```

**After:**
```javascript
await showAlert('Operation completed!', 'success');
const confirmed = await showConfirm('Are you sure?');
if (confirmed) {
    // do something
}
const name = await showPrompt('Enter your name:');
```

### With Async/Await

```javascript
async function deleteProperty(id) {
    const confirmed = await showConfirm(
        'This will permanently delete the property. Continue?',
        { title: 'Delete Property', danger: true }
    );
    
    if (!confirmed) return;
    
    try {
        await apiCall(`/properties/${id}`, { method: 'DELETE' });
        showToast('Property deleted successfully', 'success');
    } catch (error) {
        await showAlert(error.message, 'error', 'Delete Failed');
    }
}
```

## Styling

The alert system comes with built-in dark mode support and is fully customizable via CSS variables. See `css/alerts.css` for customization options.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- All modern mobile browsers

## Examples in Use

See the following files for real-world examples:
- `js/admin.js` - Admin confirmations and prompts
- `js/agent-dashboard.js` - Property deletion confirmations
- `js/login.js` - Error alerts
- Throughout the application - Toast notifications

## Benefits Over Native Alerts

✅ Better UX with smooth animations  
✅ Consistent styling across browsers  
✅ Non-blocking (especially toasts)  
✅ Customizable appearance  
✅ Promise-based API  
✅ Mobile-friendly  
✅ Dark mode support  
✅ Keyboard navigation (ESC to cancel)  
✅ Click outside to dismiss  

---

Built with ❤️ for PropertyHub
