# Basset Hound MCP Server - Usage Examples

This document provides practical examples of using the Basset Hound MCP server with AI agents like Claude.

## Table of Contents

- [Basic Navigation](#basic-navigation)
- [Form Filling](#form-filling)
- [Web Scraping](#web-scraping)
- [Network Monitoring](#network-monitoring)
- [Multi-Step Workflows](#multi-step-workflows)
- [CAPTCHA Handling](#captcha-handling)
- [Dynamic Content](#dynamic-content)
- [Data Extraction](#data-extraction)
- [Testing & Automation](#testing--automation)

---

## Basic Navigation

### Example 1: Simple Navigation

**Prompt:**
```
Navigate to wikipedia.org and tell me what you see
```

**Tools Used:**
1. `navigate` - Go to the URL
2. `get_page_state` - Get page information
3. `get_content` - Extract visible text

**Expected Result:**
Claude will navigate to Wikipedia, extract the page title, visible content, and describe the page structure.

---

### Example 2: Navigate and Click

**Prompt:**
```
Go to example.com, wait for the page to load, and click on the "More information" link
```

**Tools Used:**
1. `navigate` - Go to example.com
2. `wait_for_element` - Wait for link to appear
3. `click` - Click the link
4. `get_page_state` - Verify navigation

**Expected Result:**
Successfully navigates and clicks the link, reports new page URL.

---

## Form Filling

### Example 3: Auto-Fill Contact Form

**Prompt:**
```
Navigate to https://httpbin.org/forms/post and fill out the contact form with:
- Customer name: Jane Smith
- Telephone: 555-9876
- Email: jane@example.com
- Pizza size: Medium
- Toppings: mushroom and bacon
Then submit the form
```

**Tools Used:**
1. `navigate` - Go to the form
2. `detect_forms` - Detect form structure
3. `auto_fill_form` - Fill fields automatically
4. `submit_form` - Submit the form
5. `get_page_state` - Get response

**Manual Tool Calls:**
```json
// 1. Navigate
{
  "name": "navigate",
  "arguments": {
    "url": "https://httpbin.org/forms/post"
  }
}

// 2. Detect forms
{
  "name": "detect_forms",
  "arguments": {}
}

// 3. Auto-fill
{
  "name": "auto_fill_form",
  "arguments": {
    "data": {
      "custname": "Jane Smith",
      "custtel": "555-9876",
      "custemail": "jane@example.com",
      "size": "medium",
      "topping": ["mushroom", "bacon"]
    }
  }
}

// 4. Submit
{
  "name": "submit_form",
  "arguments": {
    "selector": "form"
  }
}
```

---

### Example 4: Complex Form with Validation

**Prompt:**
```
Fill out the registration form at [URL] with the following data.
If there are validation errors, fix them and retry.
- First name: John
- Last name: Doe
- Email: john.doe@example.com
- Password: SecurePass123!
- Confirm password: SecurePass123!
- Date of birth: 1990-05-15
- Country: United States
- Terms accepted: yes
```

**Tools Used:**
1. `navigate`
2. `fill_form` (individual fields for better control)
3. `get_form_validation` - Check for errors
4. `submit_form`

**Expected Flow:**
- Fill each field individually
- Check validation state
- Retry on errors
- Submit when all fields are valid

---

## Web Scraping

### Example 5: Extract Product Information

**Prompt:**
```
Go to this e-commerce page and extract all product names and prices.
Format the results as a table.
URL: [product listing page]
```

**Tools Used:**
1. `navigate`
2. `get_page_state` - Get page structure
3. `execute_script` - Extract data with custom JavaScript

**JavaScript for Extraction:**
```javascript
{
  "name": "execute_script",
  "arguments": {
    "code": "return Array.from(document.querySelectorAll('.product')).map(p => ({ name: p.querySelector('.product-name')?.textContent.trim(), price: p.querySelector('.price')?.textContent.trim() }))"
  }
}
```

---

### Example 6: Scrape Multiple Pages

**Prompt:**
```
Navigate through the first 5 pages of search results on [URL] and collect all article titles
```

**Tools Used:**
1. `navigate` - Go to first page
2. `get_content` - Extract titles
3. `click` - Click "Next" button
4. Repeat for each page
5. `batch_execute` - Optionally batch operations

**Batch Example:**
```json
{
  "name": "batch_execute",
  "arguments": {
    "commands": [
      { "type": "navigate", "params": { "url": "https://example.com/page/1" } },
      { "type": "get_content", "params": { "selector": ".article-title" } },
      { "type": "navigate", "params": { "url": "https://example.com/page/2" } },
      { "type": "get_content", "params": { "selector": ".article-title" } }
    ]
  }
}
```

---

## Network Monitoring

### Example 7: Monitor API Calls

**Prompt:**
```
Start monitoring network requests, navigate to github.com, wait for the page to load,
then show me all API calls that were made (XHR and Fetch only)
```

**Tools Used:**
1. `start_network_capture` - Begin monitoring
2. `navigate` - Navigate to site
3. `wait_for_element` - Wait for page load
4. `stop_network_capture` - Stop monitoring
5. `get_network_log` - Get HAR file

**Tool Calls:**
```json
// 1. Start monitoring
{
  "name": "start_network_capture",
  "arguments": {
    "filter": {
      "types": ["xhr", "fetch"]
    }
  }
}

// 2. Navigate
{
  "name": "navigate",
  "arguments": {
    "url": "https://github.com"
  }
}

// 3. Wait
{
  "name": "wait_for_element",
  "arguments": {
    "selector": "body",
    "timeout": 10000
  }
}

// 4. Stop and get log
{
  "name": "stop_network_capture",
  "arguments": {}
}

{
  "name": "get_network_log",
  "arguments": {
    "format": "har"
  }
}
```

---

### Example 8: Block Analytics and Track Performance

**Prompt:**
```
Block all analytics trackers (google-analytics, facebook pixel, etc),
then load example.com and tell me how much faster it loads
```

**Tools Used:**
1. `block_urls` - Block analytics
2. `start_network_capture` - Monitor for timing
3. `navigate` - Load page
4. `get_network_stats` - Get performance metrics

---

## Multi-Step Workflows

### Example 9: Login and Navigate

**Prompt:**
```
1. Go to the login page
2. Fill in username: testuser, password: testpass
3. Click the login button
4. Wait for the dashboard to load
5. Click on the "Profile" link
6. Take a screenshot of the profile page
```

**Tools Used:**
1. `navigate`
2. `fill_form`
3. `click`
4. `wait_for_element`
5. `screenshot`

**Expected Flow:**
Sequential execution with error handling at each step.

---

### Example 10: Wizard Form Navigation

**Prompt:**
```
Complete the multi-step registration wizard at [URL]:
Step 1: Personal info (name, email, phone)
Step 2: Address (street, city, state, zip)
Step 3: Payment (card number, expiry, CVV)
Step 4: Review and submit
```

**Tools Used:**
1. `navigate`
2. `detect_wizard` - Detect multi-step form
3. `get_wizard_state` - Get current step
4. `fill_wizard_step` - Fill current step
5. `wizard_next` - Go to next step
6. Repeat for each step
7. `submit_wizard` - Final submission

**Example for Step 1:**
```json
{
  "name": "fill_wizard_step",
  "arguments": {
    "data": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "555-1234"
    }
  }
}

{
  "name": "wizard_next",
  "arguments": {}
}
```

---

## CAPTCHA Handling

### Example 11: Detect and Report CAPTCHA

**Prompt:**
```
Navigate to [URL] and try to submit the form.
If you encounter a CAPTCHA, let me know what type it is.
```

**Tools Used:**
1. `navigate`
2. `detect_captcha` - Detect CAPTCHA presence
3. `get_captcha_state` - Get CAPTCHA details

**CAPTCHA Response:**
```json
{
  "detected": true,
  "types": ["recaptcha"],
  "count": 1,
  "elements": [
    {
      "type": "recaptcha",
      "selector": "div.g-recaptcha"
    }
  ]
}
```

**Claude's Response:**
"I've detected a Google reCAPTCHA on this page. I cannot solve CAPTCHAs automatically. Would you like me to wait while you solve it manually?"

---

## Dynamic Content

### Example 12: Handle Dynamic Loading

**Prompt:**
```
Go to [infinite scroll page], scroll down 3 times waiting for new content to load each time,
then extract all article titles
```

**Tools Used:**
1. `navigate`
2. `execute_script` - Scroll down
3. `wait_for_element` - Wait for new content
4. `get_content` - Extract titles

**Scroll Script:**
```json
{
  "name": "execute_script",
  "arguments": {
    "code": "window.scrollBy(0, 1000)"
  }
}

{
  "name": "wait_for_element",
  "arguments": {
    "selector": ".article:nth-child(20)",
    "timeout": 5000
  }
}
```

---

### Example 13: Wait for AJAX Content

**Prompt:**
```
On this page, select "California" from the state dropdown and wait for the city dropdown to populate with cities.
Then select "Los Angeles" from the city dropdown.
```

**Tools Used:**
1. `fill_select` - Select state
2. `wait_for_field` - Wait for city dropdown
3. `get_select_options` - Get available cities
4. `set_select_value` - Select city

---

## Data Extraction

### Example 14: Extract Table Data

**Prompt:**
```
Navigate to [URL with data table] and extract all data from the table into JSON format
```

**Tools Used:**
1. `navigate`
2. `execute_script` - Extract table data

**Table Extraction Script:**
```javascript
{
  "name": "execute_script",
  "arguments": {
    "code": `
      const table = document.querySelector('table');
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
        return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
      });
      return rows;
    `
  }
}
```

---

### Example 15: Monitor Page Changes

**Prompt:**
```
Watch the stock price element on this page and notify me when it changes.
Check every 5 seconds for 1 minute.
```

**Tools Used:**
1. `navigate`
2. `observe_form_changes` or `execute_script` with polling
3. `get_content` - Extract price

---

## Testing & Automation

### Example 16: Automated Form Testing

**Prompt:**
```
Test the contact form at [URL] with these scenarios:
1. Valid data - should succeed
2. Missing email - should show error
3. Invalid email format - should show error
4. Missing required fields - should show error

Report the results for each test case.
```

**Tools Used:**
1. `navigate`
2. `fill_form` - Fill with test data
3. `submit_form`
4. `get_form_validation` - Check errors
5. Repeat for each scenario

---

### Example 17: Performance Testing

**Prompt:**
```
Measure page load time for example.com with and without images.
First load normally, then block all images and load again. Compare the times.
```

**Tools Used:**
1. `start_network_capture`
2. `navigate`
3. `get_network_stats` - Get timing
4. `block_urls` - Block images (pattern: `*.jpg,*.png,*.gif`)
5. `navigate` - Reload
6. `get_network_stats` - Compare

---

### Example 18: Batch URL Testing

**Prompt:**
```
Check if these URLs are accessible and return their status:
- https://google.com
- https://github.com
- https://example.com
- https://httpbin.org/status/404
```

**Tools Used:**
1. `batch_execute` - Test all URLs
2. `navigate` for each
3. `get_page_state` - Check status

---

## Advanced Examples

### Example 19: Cookie Manipulation

**Prompt:**
```
1. Navigate to example.com
2. Get all cookies
3. Clear cookies
4. Set a custom cookie: name=test, value=12345
5. Reload the page
6. Verify the cookie exists
```

**Tools Used:**
```json
// Get cookies
{"name": "get_cookies", "arguments": {}}

// Clear by clearing storage
{"name": "clear_storage", "arguments": {"type": "both"}}

// Set cookie
{
  "name": "set_cookies",
  "arguments": {
    "cookies": [{
      "name": "test",
      "value": "12345",
      "url": "https://example.com",
      "domain": "example.com"
    }]
  }
}

// Reload
{"name": "navigate", "arguments": {"url": "https://example.com"}}

// Verify
{"name": "get_cookies", "arguments": {"name": "test"}}
```

---

### Example 20: Cross-Frame Interaction

**Prompt:**
```
The login form is inside an iframe on this page.
Switch to the iframe, fill the login form, and submit it.
```

**Tools Used:**
1. `get_frames` - Find all frames
2. `get_frame_info` - Get frame details
3. `execute_in_frame` - Execute commands in frame

**Example:**
```json
// Get frames
{"name": "get_frames", "arguments": {}}

// Execute in specific frame
{
  "name": "execute_in_frame",
  "arguments": {
    "frameId": "frame_123",
    "command": "fill_form",
    "params": {
      "data": {
        "#username": "testuser",
        "#password": "testpass"
      }
    }
  }
}
```

---

## Tips for Effective Prompts

### Be Specific
✅ Good: "Navigate to google.com and search for 'MCP protocol' by typing in the search box and clicking the search button"

❌ Bad: "Search Google for MCP protocol"

### Handle Errors
✅ Good: "Try to fill the form. If there are validation errors, tell me what they are."

❌ Bad: "Fill the form" (doesn't account for errors)

### Wait for Dynamic Content
✅ Good: "Click the button, wait for the modal to appear, then fill the form in the modal"

❌ Bad: "Click the button and fill the form" (might execute before modal appears)

### Use Appropriate Selectors
✅ Good: Use IDs first: `#login-button`, then classes: `.btn-primary`, then attributes: `button[type="submit"]`

❌ Bad: Complex selectors: `div > div > div > button:nth-child(3)`

---

## Common Patterns

### Pattern 1: Navigate, Wait, Interact
```
1. navigate(url)
2. wait_for_element(selector)
3. click/fill_form/etc
```

### Pattern 2: Extract Data Loop
```
1. navigate(page)
2. get_content(selector)
3. click(next_button)
4. Repeat 2-3
```

### Pattern 3: Form Fill with Validation
```
1. fill_form(data)
2. get_form_validation()
3. If errors: fix and retry
4. submit_form()
```

### Pattern 4: Network Monitor
```
1. start_network_capture()
2. perform_actions()
3. stop_network_capture()
4. get_network_log()
```

---

## Tool Combinations

### Data Extraction
- `navigate` + `get_page_state` + `execute_script`
- `navigate` + `wait_for_element` + `get_content`

### Form Automation
- `detect_forms` + `auto_fill_form` + `submit_form`
- `fill_form` + `get_form_validation` + `submit_form`

### Testing
- `batch_execute` + `navigate` + `get_page_state`
- `start_network_capture` + `navigate` + `get_network_stats`

### Multi-Step
- `detect_wizard` + `fill_wizard_step` + `wizard_next`
- `navigate` + `click` + `wait_for_element` + `fill_form`

---

**Examples Version**: 1.0.0
**Last Updated**: 2025-12-29
**For**: Basset Hound MCP Server

For more information, see the main README.md file.
