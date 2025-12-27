# Form Automation API

This document describes the advanced form automation capabilities of the Basset Hound Browser Automation extension.

## Overview

The form automation system provides intelligent form detection, auto-fill capabilities, and advanced interaction handling for various form elements. All commands are sent via WebSocket from the backend to the browser extension.

## WebSocket Command Format

All commands follow this format:

```json
{
  "command_id": "unique-command-id",
  "type": "command_type",
  "params": {
    // command-specific parameters
  }
}
```

## Form Detection Commands

### detect_forms

Detects and analyzes all forms on the current page.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| includeHidden | boolean | false | Include hidden forms in detection |

**Response:**
```json
{
  "success": true,
  "forms": [
    {
      "index": 0,
      "selector": "#login-form",
      "type": "login",
      "confidence": 85,
      "attributes": {
        "id": "login-form",
        "name": "login",
        "action": "/auth/login",
        "method": "POST"
      },
      "fields": [...],
      "fieldCount": 3,
      "captcha": null,
      "validation": {...},
      "multiStep": null,
      "submitButton": {...}
    }
  ],
  "formCount": 1
}
```

**Form Types Detected:**
- `login` - Login/sign-in forms
- `registration` - Account creation forms
- `contact` - Contact/inquiry forms
- `payment` - Credit card payment forms
- `checkout` - E-commerce checkout forms
- `address` - Shipping/billing address forms
- `newsletter` - Email subscription forms
- `profile` - User profile forms
- `search` - Search query forms
- `password_reset` - Password recovery forms
- `unknown` - Unrecognized form type

### get_form_validation

Gets validation errors for a specific form.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| formSelector | string | No | CSS selector for form (uses first form if not specified) |

**Response:**
```json
{
  "success": true,
  "isValid": false,
  "errors": [
    {
      "selector": "#email",
      "name": "email",
      "message": "Please enter a valid email address",
      "validity": {
        "typeMismatch": true
      }
    }
  ],
  "formErrors": []
}
```

## Form Filling Commands

### auto_fill_form

Automatically fills a form using template data or direct field mappings.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| formSelector | string | No | CSS selector for target form |
| data | object | Yes | Field data (see Data Formats below) |
| options.humanLike | boolean | No | Use human-like typing (default: true) |
| options.skipHidden | boolean | No | Skip hidden fields (default: true) |
| options.validateBefore | boolean | No | Validate before submit (default: false) |
| options.submitAfter | boolean | No | Submit form after filling (default: false) |

**Data Formats:**

1. **Direct selector mapping:**
```json
{
  "data": {
    "#email": "user@example.com",
    "[name='password']": "mypassword123",
    "#remember-me": true
  }
}
```

2. **Field type mapping:**
```json
{
  "data": {
    "email": "user@example.com",
    "password": "mypassword123",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

3. **Template data (auto-mapped):**
```json
{
  "data": {
    "personal": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "account": {
      "username": "johndoe",
      "password": "SecurePass123!"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "filled": [
    { "selector": "#email", "success": true, "fieldType": "email" },
    { "selector": "#password", "success": true, "fieldType": "password" }
  ],
  "filledCount": 2,
  "totalFields": 3,
  "validationErrors": []
}
```

### fill_form

Basic form filling with direct selector-to-value mapping.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fields | object | Yes | Selector-to-value mappings |
| submit | boolean | No | Submit form after filling (default: false) |

**Example:**
```json
{
  "type": "fill_form",
  "params": {
    "fields": {
      "#username": "testuser",
      "#password": "testpass123"
    },
    "submit": true
  }
}
```

### submit_form

Submits a form.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| formSelector | string | No | CSS selector for form |
| options.clickSubmit | boolean | No | Click submit button (default: true) |
| options.waitForNavigation | boolean | No | Wait for page navigation (default: false) |

**Response:**
```json
{
  "success": true,
  "method": "click",
  "buttonSelector": "button[type='submit']"
}
```

## Advanced Interaction Commands

### fill_select

Fills a select/dropdown element.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for select element |
| value | string | Yes | Value or text to select |
| options.byText | boolean | No | Match by visible text (default: false) |
| options.humanLike | boolean | No | Simulate human interaction (default: true) |

**Example:**
```json
{
  "type": "fill_select",
  "params": {
    "selector": "#country",
    "value": "US",
    "options": { "byText": false }
  }
}
```

**Response:**
```json
{
  "success": true,
  "selectedValue": "US",
  "selectedText": "United States"
}
```

### fill_checkbox

Fills a checkbox element.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for checkbox |
| checked | boolean | No | Check state (default: true) |

**Example:**
```json
{
  "type": "fill_checkbox",
  "params": {
    "selector": "#agree-terms",
    "checked": true
  }
}
```

### fill_radio

Selects a radio button from a group.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Radio button group name |
| value | string | Yes | Value to select |

**Example:**
```json
{
  "type": "fill_radio",
  "params": {
    "name": "payment_method",
    "value": "credit_card"
  }
}
```

**Response (if not found):**
```json
{
  "success": false,
  "error": "Radio option not found",
  "availableOptions": [
    { "value": "credit_card", "label": "Credit Card", "checked": false },
    { "value": "paypal", "label": "PayPal", "checked": false }
  ]
}
```

### fill_date

Fills a date input field.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for date input |
| date | string | Yes | Date value (YYYY-MM-DD format) |
| options.format | string | No | Input format hint (default: "iso") |
| options.openPicker | boolean | No | Try to open date picker (default: true) |

**Example:**
```json
{
  "type": "fill_date",
  "params": {
    "selector": "#birth_date",
    "date": "1990-05-15"
  }
}
```

### handle_file_upload

Handles file input fields. Due to browser security, files cannot be set programmatically.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| selector | string | Yes | CSS selector for file input |
| fileInfo | object | No | Information about desired files |

**Response:**
```json
{
  "success": true,
  "needsUserAction": true,
  "message": "File inputs require user interaction for security.",
  "inputInfo": {
    "selector": "#file-upload",
    "accept": ".pdf,.doc",
    "multiple": false,
    "required": true
  }
}
```

## Multi-Step Form Commands

### get_multi_step_info

Gets information about multi-step/wizard forms.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| formSelector | string | No | CSS selector for form |

**Response:**
```json
{
  "success": true,
  "multiStep": {
    "isMultiStep": true,
    "totalSteps": 3,
    "currentStep": 1,
    "hasStepIndicators": true,
    "hasNavigationButtons": true,
    "sections": [...],
    "navigationButtons": [
      { "selector": ".btn-next", "text": "Next", "type": "next" },
      { "selector": ".btn-prev", "text": "Back", "type": "prev" }
    ]
  }
}
```

### navigate_multi_step

Navigates to the next or previous step in a multi-step form.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| formSelector | string | No | CSS selector for form |
| direction | string | No | "next" or "prev" (default: "next") |

**Response:**
```json
{
  "success": true,
  "direction": "next",
  "buttonClicked": ".btn-next"
}
```

## CAPTCHA Detection

The form detector identifies various CAPTCHA types:

| CAPTCHA Type | Detection Method |
|--------------|-----------------|
| reCAPTCHA v2 | `.g-recaptcha` element with `data-sitekey` |
| reCAPTCHA v3 | Script with `render` parameter |
| hCaptcha | `.h-captcha` element |
| Cloudflare Turnstile | `.cf-turnstile` element |
| FunCaptcha | `#funcaptcha` with `data-pkey` |
| Image CAPTCHA | Images with `captcha` in src/alt/class |
| Text CAPTCHA | Elements with captcha-related text |

**CAPTCHA Response Format:**
```json
{
  "captcha": {
    "type": "recaptcha_v2",
    "siteKey": "6Le...",
    "selector": ".g-recaptcha",
    "visible": true
  }
}
```

## Field Type Mappings

The template mapper supports automatic field type detection:

| Field Type | Common Names/Patterns |
|------------|----------------------|
| username | username, user, login, account, uid |
| email | email, mail, emailaddress |
| password | password, pass, pwd, secret |
| confirmPassword | confirm_password, password2, repassword |
| firstName | firstname, first_name, fname |
| lastName | lastname, last_name, lname |
| fullName | name, fullname, your_name |
| phone | phone, telephone, tel, mobile |
| address | address, street, line1 |
| city | city, town, locality |
| state | state, province, region |
| zipCode | zip, zipcode, postal, postcode |
| country | country, nation |
| cardNumber | cardnumber, cc_number, creditcard |
| cardName | cardname, nameoncard, cardholder |
| expiry | expiry, expiration, exp_date |
| cvv | cvv, cvc, security_code |

## Human-Like Interactions

When `humanLike: true` is enabled (default), the extension:

1. **Typing simulation:**
   - Types characters one at a time
   - Adds randomized delays between keystrokes (10ms ± 5ms)
   - Dispatches realistic keyboard events (keydown, keypress, keyup)

2. **Click simulation:**
   - Dispatches full mouse event sequence (mouseenter, mouseover, mousedown, mouseup, click)
   - Calculates click position at element center
   - Adds small delays between events

3. **Focus/Blur handling:**
   - Properly focuses elements before interaction
   - Scrolls elements into view smoothly
   - Blurs elements after completion

## Error Handling

All commands return structured error responses:

```json
{
  "success": false,
  "error": "Element not found: #nonexistent",
  "availableOptions": [...]  // When applicable
}
```

Common error types:
- Element not found
- Form not found
- Invalid selector
- Validation errors
- Timeout errors

## Usage Examples

### Complete Login Flow

```json
[
  {
    "command_id": "1",
    "type": "detect_forms",
    "params": {}
  },
  {
    "command_id": "2",
    "type": "auto_fill_form",
    "params": {
      "formSelector": "#login-form",
      "data": {
        "username": "testuser",
        "password": "testpass123"
      },
      "options": {
        "humanLike": true,
        "submitAfter": true
      }
    }
  }
]
```

### Multi-Step Registration

```json
[
  {
    "command_id": "1",
    "type": "auto_fill_form",
    "params": {
      "data": {
        "email": "user@example.com",
        "password": "SecurePass123!"
      }
    }
  },
  {
    "command_id": "2",
    "type": "navigate_multi_step",
    "params": { "direction": "next" }
  },
  {
    "command_id": "3",
    "type": "auto_fill_form",
    "params": {
      "data": {
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1-555-123-4567"
      }
    }
  },
  {
    "command_id": "4",
    "type": "navigate_multi_step",
    "params": { "direction": "next" }
  },
  {
    "command_id": "5",
    "type": "fill_checkbox",
    "params": {
      "selector": "#agree-terms",
      "checked": true
    }
  },
  {
    "command_id": "6",
    "type": "submit_form",
    "params": {}
  }
]
```

### Complex Form with Mixed Elements

```json
{
  "command_id": "complex-form",
  "type": "auto_fill_form",
  "params": {
    "data": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "country": "US",
      "birthDate": "1990-01-15",
      "gender": "male",
      "newsletter": true
    },
    "options": {
      "humanLike": true,
      "validateBefore": true
    }
  }
}
```
