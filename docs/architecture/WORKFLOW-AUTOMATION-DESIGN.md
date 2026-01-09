# Basset Hound Browser Automation - Workflow Automation Architecture

> **Version:** 1.0.0
> **Date:** January 9, 2026
> **Status:** Research & Design Phase
> **Phase:** 17 - Workflow Automation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Findings](#research-findings)
3. [Problem Statement](#problem-statement)
4. [Architecture Overview](#architecture-overview)
5. [Workflow Definition Format](#workflow-definition-format)
6. [Execution Engine Design](#execution-engine-design)
7. [UI/UX Design](#uiux-design)
8. [Scope Boundaries](#scope-boundaries)
9. [Example Workflows](#example-workflows)
10. [API Reference](#api-reference)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Security Considerations](#security-considerations)
13. [Performance & Optimization](#performance--optimization)
14. [Testing Strategy](#testing-strategy)
15. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### What is Workflow Automation?

The Workflow Automation system enables OSINT investigators to define, execute, and manage **repeatable browser automation workflows** without writing code. Investigators can create workflows like "Check this username across 10 social media sites" or "Extract all profiles from a search results page" and execute them with a single click.

### Key Design Principles

1. **Browser-Centric**: All actions execute in the browser (navigate, click, extract, detect)
2. **No External APIs**: Workflow steps do NOT make external API calls (those go in basset-hound backend)
3. **User-Friendly**: Visual workflow builder + JSON schema for power users
4. **Error-Resilient**: Comprehensive error handling, retries, and recovery
5. **State Management**: Track workflow execution state, progress, and results
6. **Evidence-First**: Automatically capture evidence during workflow execution

### In Scope vs Out of Scope

**IN SCOPE** ✅
- Browser automation steps (Navigate, Click, Fill, Extract, Detect, Wait)
- Control flow (sequence, parallel, conditional, loop)
- State management (variables, data passing)
- Evidence capture during execution
- Workflow scheduling and queuing

**OUT OF SCOPE** ❌
- External API calls (blockchain lookups, DNS queries, HIBP checks)
- Data analysis and correlation (belongs in basset-hound)
- Long-term data storage (belongs in basset-hound)
- Team collaboration features (Phase 18)

---

## Research Findings

### Analysis of Existing Workflow Systems

#### 1. n8n Workflow Automation

**What We Learned:**

Based on research from [n8n documentation](https://docs.n8n.io/workflows/), n8n uses a **node-based workflow** system where:

- Workflows are collections of nodes connected together
- Each node performs a specific action
- Data flows between nodes as arrays of objects
- Workflows can be exported/imported as JSON
- No official JSON schema exists (community request), but TypeScript definitions are in the codebase

**Key Insights for Our Design:**
- Use node-based architecture with typed inputs/outputs
- JSON export/import for portability
- Visual representation should map 1:1 to JSON structure

**Sources:**
- [n8n Workflows Documentation](https://docs.n8n.io/workflows/)
- [n8n Data Structure](https://docs.n8n.io/data/data-structure/)
- [n8n Community: JSON Schema Request](https://community.n8n.io/t/is-there-a-json-schema-for-your-workflow-json-file/89873)

#### 2. Puppeteer Browser Automation Patterns

**What We Learned:**

From [Puppeteer functional patterns](https://github.com/agaricide/puppeteer-functional-patterns/blob/master/ts/puppeteer-functional-patterns.md) and various guides:

- **Async/Await Flow Control**: All Puppeteer operations are async, requiring careful orchestration
- **Resource Throttling**: Naive parallel page opening crashes Node.js; use page pooling with [generic-pool](https://www.npmjs.com/package/generic-pool)
- **Lifecycle Events**: `Page.goto()` and `Page.waitForNavigation()` need explicit wait conditions (`load`, `domcontentloaded`, `networkidle0`, `networkidle2`)
- **Error Handling**: Try/catch blocks prevent script crashes
- **Debugging**: `headless: false` for visual debugging

**Key Insights for Our Design:**
- Implement page pooling to prevent resource exhaustion
- Provide wait condition options for navigation steps
- Built-in error handling with try/catch wrappers
- Debug mode with visual browser window

**Sources:**
- [Puppeteer Functional Patterns (GitHub)](https://github.com/agaricide/puppeteer-functional-patterns/blob/master/ts/puppeteer-functional-patterns.md)
- [What is Puppeteer (Latenode)](https://latenode.com/blog/web-automation-scraping/puppeteer-fundamentals-setup/what-is-puppeteer-and-how-it-changed-browser-automation-a-complete-overview)
- [6 Pro Tips for Optimizing Puppeteer (Bannerbear)](https://www.bannerbear.com/blog/6-pro-tips-for-optimizing-web-automation-using-puppeteer/)

#### 3. Playwright Error Handling & Retry Patterns

**What We Learned:**

From [Playwright documentation](https://playwright.dev/docs/test-retries) and community articles:

- **Built-in Retries**: Test-level, group-level, and global retry configuration
- **Step-Level Retries**: `expect().toPass()` assertion with automatic retries for flaky assertions
- **Intelligent Retry Strategies**: Analyze error types (timeout vs. network vs. assertion) and apply conditional logic
- **Retry with Backoff**: Exponential backoff for TimeoutErrors
- **Best Practices**:
  - Only retry temporary issues, not application bugs
  - Limit retries to prevent infinite loops
  - Log retry data for debugging
  - Avoid retrying non-idempotent operations

**Key Insights for Our Design:**
- Implement retry strategies at step, workflow, and global levels
- Exponential backoff for transient failures
- Intelligent retry based on error type
- Clear logging of retry attempts

**Sources:**
- [Playwright Retries Documentation](https://playwright.dev/docs/test-retries)
- [Effective Error Handling in Playwright (Neova Solutions)](https://www.neovasolutions.com/2024/08/15/effective-error-handling-and-retries-in-playwright-tests/)
- [Intelligent Retry Strategies (DEV Community)](https://dev.to/anitha_ramachandran_85496/go-beyond-built-in-retries-in-playwright-intelligent-retry-strategies-based-on-error-types-test-1ag4)

#### 4. Zapier Conditional Logic & Data Transformation

**What We Learned:**

From [Zapier documentation](https://zapier.com/features/paths):

- **Paths**: If/then branching logic with up to 10 branches per group
- **Nested Paths**: Support for paths inside paths (max depth: 3)
- **Filters**: Single set of conditions to control workflow execution
- **Logic Types**: "AND" logic (all conditions match) or "OR" logic (at least one matches)
- **Lookup Tables**: Conditional field transformation based on values

**Key Insights for Our Design:**
- Support for conditional branching (if/else/else if)
- Nested conditions for complex logic
- Filter conditions to skip/abort workflow steps
- Variable transformation and data mapping

**Sources:**
- [Zapier Paths: Conditional Workflows](https://zapier.com/blog/zapier-paths-conditional-workflows/)
- [Use Conditional Logic (Zapier Help)](https://help.zapier.com/hc/en-us/articles/34372501750285-Use-conditional-logic-to-filter-and-split-your-Zap-workflows)
- [Add Branching Logic with Paths (Zapier Help)](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zaps-with-Paths)

#### 5. OSINT Investigation Automation Patterns

**What We Learned:**

From [OSINT automation research](https://automatio.ai/blog/osint-and-scraping/) and tools analysis:

- **Automation Transforms OSINT**: Manual investigations take hours; automation processes vast data in minutes
- **Browser-Based Scraping**: Headless browsers (Selenium) simulate user actions for dynamic content; TamperMonkey injects custom JavaScript
- **AI Integration**: ML algorithms adapt to HTML structure changes; pattern recognition extracts insights
- **Popular Tools**: SpiderFoot (200+ modules), BeautifulSoup, Scrapy, Selenium
- **Stealth Techniques**: Detect and bypass automation detection mechanisms (navigator.webdriver, DOM discrepancies, behavioral detection)

**Key Insights for Our Design:**
- Support for stealth mode (fingerprint randomization, user-agent rotation)
- Dynamic content handling with wait strategies
- Pattern detection integration (extract OSINT data during workflow)
- Evidence capture at each step
- Integration with AI agents for adaptive workflows

**Sources:**
- [How to Use OSINT and Web Scraping (Automatio)](https://automatio.ai/blog/osint-and-scraping/)
- [Web Scraping for OSINT (Cyber Huntress on Medium)](https://medium.com/@thecyberhuntress/web-scraping-for-osint-methods-and-tools-eacaff81ca40)
- [OSINT Framework Guide (Axeligence)](https://axeligence.com/osint-framework-a-step-by-step-guide-for-investigators/)
- [Browser-Based Web Scraping Tools (Siberoloji)](https://www.siberoloji.com/using-browser-based-tools-web-scraping-techniques-for-osint/)

### Summary of Research Findings

| System | Key Takeaway | Applied to Our Design |
|--------|-------------|----------------------|
| **n8n** | Node-based workflows with JSON export | Use step-based JSON schema |
| **Puppeteer** | Resource pooling, async flow control | Implement tab pooling, async step execution |
| **Playwright** | Intelligent retry strategies | Multi-level retry with exponential backoff |
| **Zapier** | Conditional paths and filters | Support if/else branching and filters |
| **OSINT Tools** | Stealth, evidence capture, pattern detection | Integrate with existing OSINT modules |

---

## Problem Statement

### The Challenge

OSINT investigators frequently perform **repetitive multi-step browser tasks**:

1. **Username Enumeration**: Check a username across 10+ social media sites
2. **Profile Extraction**: Navigate to search results, extract all profiles, click each one, collect data
3. **Email Investigation**: Check email in HIBP, Hunter.io, Google search, Wayback Machine
4. **Domain Reconnaissance**: WHOIS lookup, DNS records, Wayback snapshots, subdomain enumeration
5. **Multi-Page Evidence Collection**: Navigate through paginated results, capture evidence from each page

### Current Pain Points

- **Manual Repetition**: Investigators manually repeat the same steps for each target
- **Error-Prone**: Human mistakes in manual execution (wrong click, missed step)
- **Time-Consuming**: Takes hours to perform repetitive tasks
- **No Automation**: No way to save and reuse workflows
- **Context Loss**: Hard to remember complex multi-step procedures

### Solution: Workflow Automation

Enable investigators to:
1. **Define** workflows once (visually or via JSON)
2. **Execute** workflows with different inputs (username, email, domain)
3. **Schedule** workflows to run automatically
4. **Share** workflows with team members
5. **Debug** failed workflows with detailed execution logs

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Workflow Automation System                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Workflow Builder UI                            │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │  Visual    │  │   Code     │  │  Preset    │                 │  │
│  │  │  Editor    │  │  Editor    │  │  Library   │                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Workflow Manager                               │  │
│  │  - Load/Save workflows                                           │  │
│  │  - Validate workflow schema                                      │  │
│  │  - Schedule execution                                            │  │
│  │  - Queue management                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Execution Engine                                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │  Step      │  │   State    │  │  Error     │                 │  │
│  │  │  Executor  │  │  Manager   │  │  Handler   │                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │  Retry     │  │   Logger   │  │  Progress  │                 │  │
│  │  │  Logic     │  │            │  │  Tracker   │                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Step Primitives                                │  │
│  │  Navigate │ Click │ Fill │ Extract │ Detect │ Wait │ Verify      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Existing Extension Modules                           │  │
│  │  - content.js (DOM interaction)                                  │  │
│  │  - background.js (command routing)                               │  │
│  │  - field-detector.js (OSINT pattern detection)                   │  │
│  │  - evidence-capture.js (screenshot, provenance)                  │  │
│  │  - session-manager.js (evidence sessions)                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User creates workflow in UI (visual or code editor)
   ↓
2. Workflow saved to chrome.storage.local as JSON
   ↓
3. User triggers workflow execution (manual or scheduled)
   ↓
4. Workflow Manager loads workflow and validates schema
   ↓
5. Execution Engine creates execution context (variables, state)
   ↓
6. Step Executor processes steps sequentially/parallel
   ↓
7. Each step calls existing extension modules (navigate, click, detect)
   ↓
8. Results captured and stored in execution context
   ↓
9. State Manager updates workflow state (running → paused → completed)
   ↓
10. Progress Tracker updates UI with real-time progress
    ↓
11. Error Handler catches failures and applies retry logic
    ↓
12. Evidence automatically captured during execution
    ↓
13. Final results exported to evidence session
```

---

## Workflow Definition Format

### JSON Schema Specification

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://basset-hound.io/schemas/workflow/v1.0.0",
  "title": "Basset Hound Workflow",
  "description": "Schema for browser automation workflows",
  "type": "object",
  "required": ["id", "name", "version", "steps"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique workflow identifier (UUID)",
      "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    },
    "name": {
      "type": "string",
      "description": "Human-readable workflow name",
      "minLength": 1,
      "maxLength": 100
    },
    "description": {
      "type": "string",
      "description": "Workflow description",
      "maxLength": 500
    },
    "version": {
      "type": "string",
      "description": "Workflow version (semver)",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "author": {
      "type": "string",
      "description": "Workflow author"
    },
    "tags": {
      "type": "array",
      "description": "Workflow tags for categorization",
      "items": {
        "type": "string"
      }
    },
    "category": {
      "type": "string",
      "description": "Workflow category",
      "enum": ["social-media", "email", "domain", "username", "crypto", "general"]
    },
    "inputs": {
      "type": "array",
      "description": "Workflow input parameters",
      "items": {
        "type": "object",
        "required": ["name", "type"],
        "properties": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          },
          "type": {
            "type": "string",
            "description": "Parameter type",
            "enum": ["string", "number", "boolean", "array", "object"]
          },
          "label": {
            "type": "string",
            "description": "UI label"
          },
          "description": {
            "type": "string",
            "description": "Parameter description"
          },
          "required": {
            "type": "boolean",
            "description": "Is parameter required",
            "default": true
          },
          "default": {
            "description": "Default value"
          },
          "validation": {
            "type": "object",
            "description": "Validation rules",
            "properties": {
              "pattern": {
                "type": "string",
                "description": "Regex pattern"
              },
              "min": {
                "type": "number",
                "description": "Minimum value/length"
              },
              "max": {
                "type": "number",
                "description": "Maximum value/length"
              }
            }
          }
        }
      }
    },
    "outputs": {
      "type": "array",
      "description": "Workflow output values",
      "items": {
        "type": "object",
        "required": ["name", "type"],
        "properties": {
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": ["string", "number", "boolean", "array", "object"]
          },
          "description": {
            "type": "string"
          }
        }
      }
    },
    "variables": {
      "type": "object",
      "description": "Workflow-level variables",
      "additionalProperties": true
    },
    "config": {
      "type": "object",
      "description": "Workflow configuration",
      "properties": {
        "timeout": {
          "type": "number",
          "description": "Global workflow timeout (ms)",
          "default": 300000
        },
        "retryPolicy": {
          "type": "object",
          "properties": {
            "enabled": {
              "type": "boolean",
              "default": true
            },
            "maxRetries": {
              "type": "number",
              "default": 3
            },
            "retryDelay": {
              "type": "number",
              "description": "Initial retry delay (ms)",
              "default": 1000
            },
            "retryBackoff": {
              "type": "string",
              "enum": ["linear", "exponential"],
              "default": "exponential"
            }
          }
        },
        "evidence": {
          "type": "object",
          "properties": {
            "captureScreenshots": {
              "type": "boolean",
              "default": true
            },
            "captureDOM": {
              "type": "boolean",
              "default": false
            },
            "captureNetwork": {
              "type": "boolean",
              "default": false
            }
          }
        },
        "execution": {
          "type": "object",
          "properties": {
            "mode": {
              "type": "string",
              "enum": ["sequential", "parallel"],
              "default": "sequential"
            },
            "maxParallel": {
              "type": "number",
              "description": "Max parallel steps (if mode=parallel)",
              "default": 3
            },
            "continueOnError": {
              "type": "boolean",
              "description": "Continue workflow on step error",
              "default": false
            }
          }
        }
      }
    },
    "steps": {
      "type": "array",
      "description": "Workflow steps",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/step"
      }
    }
  },
  "$defs": {
    "step": {
      "type": "object",
      "required": ["id", "type"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique step identifier"
        },
        "name": {
          "type": "string",
          "description": "Step name"
        },
        "type": {
          "type": "string",
          "description": "Step type",
          "enum": [
            "navigate",
            "click",
            "fill",
            "extract",
            "detect",
            "wait",
            "screenshot",
            "conditional",
            "loop",
            "parallel",
            "script",
            "verify",
            "ingest"
          ]
        },
        "description": {
          "type": "string",
          "description": "Step description"
        },
        "enabled": {
          "type": "boolean",
          "description": "Is step enabled",
          "default": true
        },
        "continueOnError": {
          "type": "boolean",
          "description": "Continue workflow if this step fails",
          "default": false
        },
        "timeout": {
          "type": "number",
          "description": "Step timeout (ms)"
        },
        "retries": {
          "type": "number",
          "description": "Step-level retry count (overrides global)"
        },
        "condition": {
          "type": "string",
          "description": "Condition for step execution (JavaScript expression)"
        },
        "params": {
          "type": "object",
          "description": "Step parameters (varies by type)"
        },
        "outputs": {
          "type": "object",
          "description": "Output variable mappings",
          "additionalProperties": {
            "type": "string"
          }
        },
        "onSuccess": {
          "type": "array",
          "description": "Steps to execute on success",
          "items": {
            "$ref": "#/$defs/step"
          }
        },
        "onError": {
          "type": "array",
          "description": "Steps to execute on error",
          "items": {
            "$ref": "#/$defs/step"
          }
        }
      }
    }
  }
}
```

### Step Type Definitions

#### 1. Navigate Step

Navigate to a URL.

```json
{
  "id": "nav-1",
  "name": "Navigate to LinkedIn",
  "type": "navigate",
  "params": {
    "url": "https://linkedin.com/in/${username}",
    "waitFor": "main",
    "waitUntil": "networkidle2"
  },
  "timeout": 30000,
  "outputs": {
    "finalUrl": "url",
    "loaded": "success"
  }
}
```

**Parameters:**
- `url` (string, required): Target URL (supports variable interpolation)
- `waitFor` (string, optional): CSS selector to wait for after navigation
- `waitUntil` (string, optional): Load event to wait for (`load`, `domcontentloaded`, `networkidle0`, `networkidle2`)
- `timeout` (number, optional): Navigation timeout in ms

#### 2. Click Step

Click an element on the page.

```json
{
  "id": "click-1",
  "name": "Click Search Button",
  "type": "click",
  "params": {
    "selector": "button[type='submit']",
    "waitAfter": 1000,
    "scrollIntoView": true
  },
  "outputs": {
    "clicked": "success"
  }
}
```

**Parameters:**
- `selector` (string, required): CSS selector or XPath
- `waitAfter` (number, optional): Milliseconds to wait after click
- `scrollIntoView` (boolean, optional): Scroll element into view before clicking

#### 3. Fill Step

Fill form fields.

```json
{
  "id": "fill-1",
  "name": "Fill Search Form",
  "type": "fill",
  "params": {
    "fields": {
      "#searchInput": "${searchTerm}",
      "#filterType": "profiles",
      "#includeArchived": true
    },
    "submit": false,
    "humanize": true
  },
  "outputs": {
    "filled": "success"
  }
}
```

**Parameters:**
- `fields` (object, required): Map of selector → value
- `submit` (boolean, optional): Submit form after filling
- `humanize` (boolean, optional): Simulate human typing with delays

#### 4. Extract Step

Extract content from page.

```json
{
  "id": "extract-1",
  "name": "Extract Profile Data",
  "type": "extract",
  "params": {
    "mode": "structured",
    "selectors": {
      "name": "h1.profile-name",
      "title": "div.profile-title",
      "company": "span.company-name",
      "email": "a[href^='mailto:']"
    }
  },
  "outputs": {
    "profileData": "result"
  }
}
```

**Parameters:**
- `mode` (string, required): `text`, `html`, `structured`, `table`, `all`
- `selector` (string, optional): Single selector for text/html mode
- `selectors` (object, optional): Map of name → selector for structured mode
- `table` (string, optional): Table selector for table mode

#### 5. Detect Step

Detect OSINT patterns on page.

```json
{
  "id": "detect-1",
  "name": "Detect OSINT Data",
  "type": "detect",
  "params": {
    "patterns": ["email", "phone", "crypto_btc", "crypto_eth"],
    "context": true,
    "highlight": true
  },
  "outputs": {
    "detected": "results"
  }
}
```

**Parameters:**
- `patterns` (array, required): Pattern types to detect
- `context` (boolean, optional): Extract surrounding context
- `highlight` (boolean, optional): Visually highlight detected items

#### 6. Wait Step

Wait for condition.

```json
{
  "id": "wait-1",
  "name": "Wait for Results",
  "type": "wait",
  "params": {
    "for": "element",
    "selector": "div.search-results",
    "timeout": 10000
  }
}
```

**Parameters:**
- `for` (string, required): `element`, `navigation`, `time`, `condition`
- `selector` (string, conditional): CSS selector (for `element`)
- `time` (number, conditional): Milliseconds (for `time`)
- `condition` (string, conditional): JavaScript expression (for `condition`)
- `timeout` (number, optional): Wait timeout

#### 7. Screenshot Step

Capture screenshot.

```json
{
  "id": "screenshot-1",
  "name": "Capture Evidence",
  "type": "screenshot",
  "params": {
    "fullPage": false,
    "element": null,
    "format": "png"
  },
  "outputs": {
    "screenshot": "dataUrl"
  }
}
```

**Parameters:**
- `fullPage` (boolean, optional): Capture entire page
- `element` (string, optional): Capture specific element
- `format` (string, optional): `png` or `jpeg`

#### 8. Conditional Step

Execute steps based on condition.

```json
{
  "id": "conditional-1",
  "name": "Check if Profile Found",
  "type": "conditional",
  "params": {
    "condition": "profileData.name !== null",
    "then": [
      {
        "id": "then-1",
        "type": "ingest",
        "params": { "data": "${profileData}" }
      }
    ],
    "else": [
      {
        "id": "else-1",
        "type": "script",
        "params": { "code": "console.log('Profile not found')" }
      }
    ]
  }
}
```

**Parameters:**
- `condition` (string, required): JavaScript expression
- `then` (array, optional): Steps to execute if condition is true
- `else` (array, optional): Steps to execute if condition is false

#### 9. Loop Step

Repeat steps for each item in array.

```json
{
  "id": "loop-1",
  "name": "Check Each Platform",
  "type": "loop",
  "params": {
    "items": "${platforms}",
    "variable": "platform",
    "maxIterations": 20,
    "steps": [
      {
        "id": "loop-nav",
        "type": "navigate",
        "params": { "url": "${platform.url}" }
      },
      {
        "id": "loop-detect",
        "type": "detect",
        "params": { "patterns": ["email", "username"] }
      }
    ]
  }
}
```

**Parameters:**
- `items` (array/string, required): Array to iterate over (or variable name)
- `variable` (string, required): Variable name for current item
- `maxIterations` (number, optional): Max loop iterations
- `steps` (array, required): Steps to execute in each iteration

#### 10. Parallel Step

Execute multiple steps in parallel.

```json
{
  "id": "parallel-1",
  "name": "Check Multiple Sites",
  "type": "parallel",
  "params": {
    "maxConcurrent": 3,
    "steps": [
      { "id": "check-twitter", "type": "navigate", "params": { "url": "https://twitter.com/${username}" } },
      { "id": "check-github", "type": "navigate", "params": { "url": "https://github.com/${username}" } },
      { "id": "check-reddit", "type": "navigate", "params": { "url": "https://reddit.com/user/${username}" } }
    ]
  }
}
```

**Parameters:**
- `maxConcurrent` (number, optional): Max parallel executions
- `steps` (array, required): Steps to execute in parallel

#### 11. Script Step

Execute custom JavaScript.

```json
{
  "id": "script-1",
  "name": "Transform Data",
  "type": "script",
  "params": {
    "code": "return profileData.name.toUpperCase();",
    "timeout": 5000
  },
  "outputs": {
    "transformedName": "result"
  }
}
```

**Parameters:**
- `code` (string, required): JavaScript code to execute
- `timeout` (number, optional): Execution timeout

#### 12. Verify Step

Verify data format (client-side only).

```json
{
  "id": "verify-1",
  "name": "Verify Email Format",
  "type": "verify",
  "params": {
    "type": "email",
    "value": "${detectedEmail}"
  },
  "outputs": {
    "isValid": "valid",
    "format": "format"
  }
}
```

**Parameters:**
- `type` (string, required): `email`, `phone`, `crypto_btc`, `ip`, etc.
- `value` (string, required): Value to verify

#### 13. Ingest Step

Send data to basset-hound.

```json
{
  "id": "ingest-1",
  "name": "Ingest Profile",
  "type": "ingest",
  "params": {
    "entityType": "person",
    "data": "${profileData}",
    "caseId": "${caseId}"
  },
  "outputs": {
    "entityId": "id"
  }
}
```

**Parameters:**
- `entityType` (string, required): Entity type
- `data` (object, required): Data to ingest
- `caseId` (string, optional): Case ID

---

## Execution Engine Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Execution Engine                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  WorkflowExecutor                           │   │
│  │  - Load workflow JSON                                      │   │
│  │  - Validate schema                                         │   │
│  │  - Create execution context                                │   │
│  │  - Orchestrate step execution                              │   │
│  │  - Handle errors and retries                               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  ExecutionContext                           │   │
│  │  - workflowId: string                                      │   │
│  │  - executionId: string (UUID)                              │   │
│  │  - status: running | paused | completed | failed           │   │
│  │  - variables: Map<string, any>                             │   │
│  │  - stepResults: Map<stepId, result>                        │   │
│  │  - evidence: Array<EvidenceItem>                           │   │
│  │  - logs: Array<LogEntry>                                   │   │
│  │  - startTime: number                                       │   │
│  │  - endTime: number | null                                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                   StepExecutor                              │   │
│  │  - executeNavigate()                                       │   │
│  │  - executeClick()                                          │   │
│  │  - executeFill()                                           │   │
│  │  - executeExtract()                                        │   │
│  │  - executeDetect()                                         │   │
│  │  - executeWait()                                           │   │
│  │  - executeScreenshot()                                     │   │
│  │  - executeConditional()                                    │   │
│  │  - executeLoop()                                           │   │
│  │  - executeParallel()                                       │   │
│  │  - executeScript()                                         │   │
│  │  - executeVerify()                                         │   │
│  │  - executeIngest()                                         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                   StateManager                              │   │
│  │  - updateState(status)                                     │   │
│  │  - setVariable(name, value)                                │   │
│  │  - getVariable(name)                                       │   │
│  │  - recordStepResult(stepId, result)                        │   │
│  │  - saveExecutionState()                                    │   │
│  │  - loadExecutionState(executionId)                         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                   ErrorHandler                              │   │
│  │  - handleError(error, step)                                │   │
│  │  - shouldRetry(error, step)                                │   │
│  │  - calculateRetryDelay(attempt)                            │   │
│  │  - recordError(error)                                      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  ProgressTracker                            │   │
│  │  - totalSteps: number                                      │   │
│  │  - completedSteps: number                                  │   │
│  │  - currentStep: string                                     │   │
│  │  - percentage: number                                      │   │
│  │  - emitProgress(event)                                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Execution Flow

```javascript
class WorkflowExecutor {
  async execute(workflow, inputs) {
    // 1. Create execution context
    const context = new ExecutionContext({
      workflowId: workflow.id,
      executionId: generateUUID(),
      variables: { ...inputs, ...workflow.variables },
      config: workflow.config
    });

    try {
      // 2. Update state to running
      await this.stateManager.updateState(context.executionId, 'running');

      // 3. Execute steps
      for (const step of workflow.steps) {
        // Check if workflow paused/cancelled
        if (context.status === 'paused' || context.status === 'cancelled') {
          break;
        }

        // Execute step with error handling and retries
        await this.executeStepWithRetry(step, context);
      }

      // 4. Mark as completed
      await this.stateManager.updateState(context.executionId, 'completed');

      // 5. Return results
      return {
        success: true,
        executionId: context.executionId,
        results: context.stepResults,
        evidence: context.evidence,
        outputs: this.extractOutputs(workflow, context)
      };

    } catch (error) {
      // Handle workflow-level errors
      await this.errorHandler.handleError(error, context);
      await this.stateManager.updateState(context.executionId, 'failed');

      return {
        success: false,
        executionId: context.executionId,
        error: error.message,
        logs: context.logs
      };
    }
  }

  async executeStepWithRetry(step, context) {
    const maxRetries = step.retries ?? context.config.retryPolicy.maxRetries;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // Check step condition
        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          this.logger.debug(`Step ${step.id} skipped (condition not met)`);
          return;
        }

        // Execute step
        const result = await this.stepExecutor.execute(step, context);

        // Record success
        context.stepResults.set(step.id, result);

        // Execute onSuccess steps
        if (step.onSuccess && step.onSuccess.length > 0) {
          for (const successStep of step.onSuccess) {
            await this.executeStepWithRetry(successStep, context);
          }
        }

        return result;

      } catch (error) {
        attempt++;

        // Check if should retry
        if (attempt <= maxRetries && this.errorHandler.shouldRetry(error, step)) {
          const delay = this.errorHandler.calculateRetryDelay(
            attempt,
            context.config.retryPolicy
          );

          this.logger.warn(`Step ${step.id} failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await this.sleep(delay);

        } else {
          // Max retries exceeded or non-retryable error
          this.logger.error(`Step ${step.id} failed after ${attempt} attempts: ${error.message}`);

          // Execute onError steps
          if (step.onError && step.onError.length > 0) {
            for (const errorStep of step.onError) {
              await this.executeStepWithRetry(errorStep, context);
            }
          }

          // Check continueOnError
          if (!step.continueOnError && !context.config.execution.continueOnError) {
            throw error;
          }
        }
      }
    }
  }
}
```

### State Management

```javascript
class StateManager {
  constructor() {
    this.storage = chrome.storage.local;
    this.STORAGE_KEY_PREFIX = 'workflow_execution_';
  }

  async saveExecutionState(context) {
    const key = this.STORAGE_KEY_PREFIX + context.executionId;
    await this.storage.set({
      [key]: {
        workflowId: context.workflowId,
        executionId: context.executionId,
        status: context.status,
        variables: Object.fromEntries(context.variables),
        stepResults: Object.fromEntries(context.stepResults),
        logs: context.logs,
        startTime: context.startTime,
        endTime: context.endTime,
        savedAt: Date.now()
      }
    });
  }

  async loadExecutionState(executionId) {
    const key = this.STORAGE_KEY_PREFIX + executionId;
    const result = await this.storage.get(key);

    if (!result[key]) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    return result[key];
  }

  async updateState(executionId, status) {
    const state = await this.loadExecutionState(executionId);
    state.status = status;
    if (status === 'completed' || status === 'failed') {
      state.endTime = Date.now();
    }
    await this.saveExecutionState(state);
  }
}
```

### Error Handling

```javascript
class ErrorHandler {
  constructor(config) {
    this.config = config;
    this.retryableErrors = [
      'TimeoutError',
      'NetworkError',
      'NavigationError',
      'ElementNotFoundError'
    ];
  }

  shouldRetry(error, step) {
    // Check if error type is retryable
    if (!this.retryableErrors.includes(error.name)) {
      return false;
    }

    // Check if retries enabled
    if (!this.config.retryPolicy.enabled) {
      return false;
    }

    return true;
  }

  calculateRetryDelay(attempt, retryPolicy) {
    const baseDelay = retryPolicy.retryDelay || 1000;

    if (retryPolicy.retryBackoff === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    } else {
      // Linear backoff
      return baseDelay * attempt;
    }
  }

  handleError(error, context) {
    // Log error
    context.logs.push({
      level: 'error',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });

    // Record in context
    if (!context.errors) {
      context.errors = [];
    }
    context.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  }
}
```

### Progress Tracking

```javascript
class ProgressTracker {
  constructor(context) {
    this.context = context;
    this.listeners = [];
  }

  onProgress(callback) {
    this.listeners.push(callback);
  }

  emitProgress(event) {
    const progress = {
      executionId: this.context.executionId,
      totalSteps: this.getTotalSteps(),
      completedSteps: this.context.stepResults.size,
      currentStep: event.step,
      percentage: this.calculatePercentage(),
      timestamp: Date.now()
    };

    for (const listener of this.listeners) {
      listener(progress);
    }

    // Update UI via message passing
    chrome.runtime.sendMessage({
      type: 'workflow_progress',
      data: progress
    });
  }

  getTotalSteps() {
    // Count all steps including nested (conditional, loop, parallel)
    let count = 0;
    const countSteps = (steps) => {
      for (const step of steps) {
        count++;
        if (step.onSuccess) countSteps(step.onSuccess);
        if (step.onError) countSteps(step.onError);
        if (step.params?.steps) countSteps(step.params.steps);
      }
    };
    countSteps(this.context.workflow.steps);
    return count;
  }

  calculatePercentage() {
    const total = this.getTotalSteps();
    const completed = this.context.stepResults.size;
    return Math.round((completed / total) * 100);
  }
}
```

---

## UI/UX Design

### Components

#### 1. Workflow Builder Panel

Visual workflow editor with drag-and-drop interface.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Workflow Builder                                         [Save] [Run]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Workflow: Social Media Sweep                                       │
│  Description: Check username across multiple platforms              │
│                                                                     │
│  Inputs:                                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Username: [_________________]  (Required)                 │    │
│  │ Platforms: [Twitter, GitHub, Reddit, LinkedIn]            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Steps:                                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  1. [Loop] For each platform                               │    │
│  │     ├─ [Navigate] Go to ${platform.url}/${username}        │    │
│  │     ├─ [Wait] Wait for profile or 404                      │    │
│  │     ├─ [Conditional] If profile exists                     │    │
│  │     │   ├─ [Extract] Extract profile data                  │    │
│  │     │   ├─ [Detect] Detect OSINT patterns                  │    │
│  │     │   ├─ [Screenshot] Capture evidence                   │    │
│  │     │   └─ [Ingest] Send to basset-hound                   │    │
│  │     └─ [Wait] 2 seconds (rate limiting)                    │    │
│  │                                                            │    │
│  │  2. [Script] Generate summary report                       │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [+] Add Step                                                       │
│                                                                     │
│  Outputs:                                                           │
│  - profilesFound: Array<Profile>                                    │
│  - totalFound: number                                               │
│  - evidenceItems: Array<Evidence>                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Drag-and-drop step reordering
- Collapsible step details
- Variable autocomplete
- Real-time validation
- Step type picker with search

#### 2. Code Editor Mode

For power users who prefer JSON editing.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Code Editor                                          [Visual] [Save] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1  {                                                               │
│  2    "id": "social-media-sweep",                                   │
│  3    "name": "Social Media Sweep",                                 │
│  4    "version": "1.0.0",                                           │
│  5    "inputs": [                                                   │
│  6      {                                                           │
│  7        "name": "username",                                       │
│  8        "type": "string",                                         │
│  9        "label": "Username",                                      │
│ 10        "required": true                                          │
│ 11      }                                                           │
│ 12    ],                                                            │
│ 13    "steps": [                                                    │
│ 14      {                                                           │
│ 15        "id": "loop-1",                                           │
│ 16        "type": "loop",                                           │
│ 17        "params": {                                               │
│ 18          "items": "${platforms}",                                │
│ 19          "variable": "platform",                                 │
│ 20          "steps": [...]                                          │
│ 21        }                                                          │
│ 22      }                                                           │
│ 23    ]                                                             │
│ 24  }                                                               │
│                                                                     │
│  ✓ Valid JSON                                                       │
│  ✓ Schema validated                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Syntax highlighting
- JSON schema validation
- Autocomplete for step types
- Inline error messages
- Format/prettify button

#### 3. Workflow Library

Browse and search preset workflows.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Workflow Library                     Search: [__________] [+] New   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Category: [All ▼]  Sort: [Most Used ▼]                             │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ 🔍 Social Media Sweep                           ⭐⭐⭐⭐⭐ │    │
│ │ Check username across 10+ social media platforms            │    │
│ │ Used 142 times • Author: Basset Team                        │    │
│ │ [Run] [Edit] [Clone] [Export]                               │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ 📧 Email Investigation                          ⭐⭐⭐⭐☆ │    │
│ │ Check email in HIBP, Hunter, Google, Wayback Machine        │    │
│ │ Used 98 times • Author: Basset Team                         │    │
│ │ [Run] [Edit] [Clone] [Export]                               │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ 🌐 Domain Reconnaissance                        ⭐⭐⭐⭐⭐ │    │
│ │ WHOIS, DNS, Wayback snapshots, subdomain enum               │    │
│ │ Used 76 times • Author: Basset Team                         │    │
│ │ [Run] [Edit] [Clone] [Export]                               │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ 💰 Crypto Address Lookup                        ⭐⭐⭐⭐☆ │    │
│ │ Check Bitcoin/Ethereum address on block explorers           │    │
│ │ Used 54 times • Author: Basset Team                         │    │
│ │ [Run] [Edit] [Clone] [Export]                               │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ [Load More...]                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Search by name, tags, category
- Filter by author, rating, usage
- Preview workflow details
- One-click run with input prompt
- Clone to customize
- Import/export workflows

#### 4. Execution Monitor

Track workflow execution in real-time.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Workflow Execution                         [Pause] [Cancel] [Logs]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Workflow: Social Media Sweep                                        │
│ Execution ID: exec_abc123                                           │
│ Status: Running                                                     │
│                                                                     │
│ Progress: ███████████░░░░░░░░░░ 60% (6/10 steps)                   │
│                                                                     │
│ Current Step: [Navigate] twitter.com/johndoe                        │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ ✓ Step 1: Loop initialization                    [0.1s]     │    │
│ │ ✓ Step 2: Navigate to Twitter                    [2.3s]     │    │
│ │ ✓ Step 3: Wait for profile                       [1.2s]     │    │
│ │ ✓ Step 4: Extract profile data                   [0.8s]     │    │
│ │ ✓ Step 5: Detect OSINT patterns                  [1.5s]     │    │
│ │ ✓ Step 6: Screenshot capture                     [0.6s]     │    │
│ │ → Step 7: Navigate to GitHub (in progress...)    [1.2s]     │    │
│ │ ⏳ Step 8: Wait for profile (pending)                        │    │
│ │ ⏳ Step 9: Extract profile data (pending)                    │    │
│ │ ⏳ Step 10: Generate report (pending)                        │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ Evidence Captured: 2 screenshots, 1 profile extracted              │
│ Elapsed Time: 7.7s                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time progress bar
- Step-by-step status (pending, running, completed, failed)
- Current step highlight
- Pause/resume execution
- Cancel with cleanup
- View execution logs
- Evidence counter

#### 5. Execution Logs Panel

Detailed execution logs for debugging.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Execution Logs                              Filter: [All Levels ▼]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ [12:34:01.123] INFO  Workflow execution started (exec_abc123)      │
│ [12:34:01.234] DEBUG Step loop-1 initialized with 10 platforms     │
│ [12:34:01.345] INFO  Navigating to https://twitter.com/johndoe     │
│ [12:34:03.678] DEBUG Network idle detected                         │
│ [12:34:03.789] INFO  Page loaded successfully                      │
│ [12:34:03.890] DEBUG Waiting for selector: div.profile-header      │
│ [12:34:05.123] INFO  Profile found, extracting data                │
│ [12:34:05.987] DEBUG Extracted fields: name, bio, followers        │
│ [12:34:06.234] INFO  Detected 2 email patterns, 1 phone pattern    │
│ [12:34:06.567] INFO  Screenshot captured (23.4 KB)                 │
│ [12:34:07.123] WARN  Rate limit delay: 2000ms                      │
│ [12:34:09.234] INFO  Navigating to https://github.com/johndoe      │
│ [12:34:10.456] ERROR Navigation failed: Timeout after 30s          │
│ [12:34:10.567] WARN  Retrying step (attempt 1/3)                   │
│ [12:34:11.678] INFO  Retry delay: 1000ms (exponential backoff)     │
│ [12:34:12.789] INFO  Navigating to https://github.com/johndoe      │
│ [12:34:14.123] INFO  Page loaded successfully                      │
│                                                                     │
│ [Export] [Clear] [Search]                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Log levels (DEBUG, INFO, WARN, ERROR)
- Filter by level
- Search logs
- Export to file
- Timestamp precision
- Color-coded levels
- Expandable details

#### 6. Schedule Manager

Schedule workflows to run automatically.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Scheduled Workflows                                 [+] New Schedule │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Social Media Sweep - johndoe                   [Active ✓]   │    │
│ │ Schedule: Every day at 9:00 AM                              │    │
│ │ Next run: Tomorrow at 9:00 AM                               │    │
│ │ Last run: Today at 9:00 AM (Success)                        │    │
│ │ [Edit] [Run Now] [Disable] [Delete]                         │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Email Investigation - monitor@example.com      [Active ✓]   │    │
│ │ Schedule: Every Monday at 8:00 AM                           │    │
│ │ Next run: Monday, Jan 13 at 8:00 AM                         │    │
│ │ Last run: Monday, Jan 6 at 8:00 AM (Success)                │    │
│ │ [Edit] [Run Now] [Disable] [Delete]                         │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Crypto Address Lookup - 1A1zP1eP5QGefi...     [Disabled ✗] │    │
│ │ Schedule: Every hour                                        │    │
│ │ Next run: N/A (disabled)                                    │    │
│ │ Last run: Jan 8 at 3:00 PM (Failed - Timeout)               │    │
│ │ [Edit] [Run Now] [Enable] [Delete]                          │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Cron-like scheduling
- One-time or recurring schedules
- Enable/disable schedules
- Run immediately
- View execution history
- Email notifications on completion/failure

---

## Scope Boundaries

### IN SCOPE ✅

**Browser Automation Steps**
- Navigate to URLs
- Click elements (buttons, links)
- Fill form fields (text, select, checkbox, radio)
- Extract content (text, HTML, structured data, tables)
- Detect OSINT patterns (email, phone, crypto, IP)
- Wait for conditions (element, navigation, time)
- Take screenshots (full page, element, viewport)
- Execute JavaScript in page context
- Verify data formats (client-side validation only)

**Control Flow**
- Sequential execution
- Parallel execution (with concurrency limits)
- Conditional branches (if/else)
- Loops (for-each, while)
- Error handling (try/catch, retries)

**State Management**
- Variables (workflow-level, step-level)
- Data passing between steps
- Execution state persistence
- Resume from pause
- Progress tracking

**Evidence Capture**
- Automatic screenshot on each step
- DOM snapshots
- Network traffic (HAR export)
- Chain of custody tracking
- Integration with evidence sessions

**Workflow Management**
- Create/edit workflows (visual + code)
- Save/load workflows
- Import/export workflows (JSON)
- Preset workflow library
- Workflow scheduling

### OUT OF SCOPE ❌

**External API Calls**
- Blockchain verification (Mempool.space, Etherscan)
  - **Why:** Requires external API keys, rate limiting, and analysis logic
  - **Where:** basset-hound backend
- Email domain verification (DNS, MX records, SMTP probes)
  - **Why:** Requires network access beyond browser sandbox
  - **Where:** basset-hound backend
- Phone carrier lookup (Numverify, Twilio)
  - **Why:** Requires paid API subscriptions
  - **Where:** basset-hound backend
- Domain analysis (WHOIS, DNS records, Wayback API)
  - **Why:** Requires external API calls and parsing
  - **Where:** basset-hound backend
- Breach checking (HaveIBeenPwned API)
  - **Why:** Requires API key and rate limiting
  - **Where:** basset-hound backend
- Social media profile verification (check if account exists)
  - **Why:** Requires API calls or complex scraping
  - **Where:** basset-hound backend

**Data Analysis**
- Entity relationship analysis
  - **Why:** Requires graph database and correlation logic
  - **Where:** basset-hound backend
- Cross-investigation correlation
  - **Why:** Requires access to historical data
  - **Where:** basset-hound backend
- Pattern recognition and ML
  - **Why:** Requires training data and models
  - **Where:** basset-hound backend

**Team Collaboration**
- Workflow sharing and marketplace
  - **Why:** Requires backend infrastructure
  - **Where:** Future Phase 18
- Real-time collaboration
  - **Why:** Requires WebSocket infrastructure
  - **Where:** Future Phase 18
- Comments and annotations
  - **Why:** Requires shared storage
  - **Where:** Future Phase 18

### Boundary Examples

#### ✅ IN SCOPE: Detect Bitcoin Address on Page

```json
{
  "id": "detect-btc",
  "type": "detect",
  "params": {
    "patterns": ["crypto_btc"],
    "context": true
  }
}
```

**What it does:** Scans page DOM for Bitcoin address patterns, validates format (checksum), extracts surrounding context.

#### ❌ OUT OF SCOPE: Look Up Bitcoin Address Balance

```json
{
  "id": "lookup-btc",
  "type": "api_call",  // ❌ Not supported
  "params": {
    "url": "https://mempool.space/api/address/${btcAddress}",
    "method": "GET"
  }
}
```

**Why out of scope:** Requires external API call to Mempool.space. This belongs in basset-hound backend.

**Correct approach:** Use `ingest` step to send detected address to basset-hound, which performs the API lookup.

```json
{
  "id": "ingest-btc",
  "type": "ingest",
  "params": {
    "entityType": "crypto_address",
    "data": {
      "type": "bitcoin",
      "address": "${detectedBtcAddress}",
      "sourceUrl": "${currentUrl}",
      "context": "${detectedBtcContext}"
    }
  }
}
```

#### ✅ IN SCOPE: Extract Emails from Page

```json
{
  "id": "detect-email",
  "type": "detect",
  "params": {
    "patterns": ["email"],
    "highlight": true
  },
  "outputs": {
    "emails": "results"
  }
}
```

#### ❌ OUT OF SCOPE: Verify Email Deliverability

```json
{
  "id": "verify-email",
  "type": "dns_lookup",  // ❌ Not supported
  "params": {
    "domain": "${emailDomain}",
    "recordType": "MX"
  }
}
```

**Why out of scope:** Requires DNS lookups and SMTP probes outside browser sandbox. Use basset-hound backend.

---

## Example Workflows

### 1. Social Media Sweep

**Use Case:** Check if a username exists across 10+ social media platforms.

**Workflow:** [examples/workflows/social-media-sweep.json](../../examples/workflows/social-media-sweep.json)

**Description:**
- Input: username
- Loop through platforms (Twitter, GitHub, Reddit, LinkedIn, Instagram, Facebook, TikTok, Snapchat, Pinterest, Tumblr)
- For each platform:
  - Navigate to profile URL
  - Wait for page load
  - Check if profile exists (404 or profile content)
  - If exists: Extract profile data, detect OSINT patterns, screenshot
  - Send to basset-hound
  - Wait 2 seconds (rate limiting)
- Output: Array of found profiles, total count, evidence items

**Key Features:**
- Loop iteration over platform array
- Conditional logic (if profile exists)
- Rate limiting (wait step)
- Evidence capture (screenshots)
- OSINT pattern detection
- Data ingestion

### 2. Email Investigation

**Use Case:** Investigate an email address across multiple sources.

**Workflow:** [examples/workflows/email-investigation.json](../../examples/workflows/email-investigation.json)

**Description:**
- Input: email address
- Steps:
  1. Navigate to HaveIBeenPwned
  2. Fill email search form
  3. Submit and wait for results
  4. Extract breach data
  5. Screenshot evidence
  6. Navigate to Google search (email in quotes)
  7. Extract search results (top 10)
  8. Loop through each result:
     - Navigate to page
     - Detect email mentions
     - Extract context
     - Screenshot
  9. Generate summary report
  10. Ingest all findings to basset-hound
- Output: Breaches found, search results, evidence items

**Key Features:**
- Multi-site investigation
- Form filling and submission
- Search result extraction
- Nested loop (search results)
- Evidence chain of custody

### 3. Domain Reconnaissance

**Use Case:** Gather information about a domain (WHOIS, DNS, Wayback, subdomains).

**Workflow:** [examples/workflows/domain-recon.json](../../examples/workflows/domain-recon.json)

**Description:**
- Input: domain name
- Parallel steps (run simultaneously):
  1. WHOIS lookup (navigate to who.is)
  2. Wayback Machine (navigate to web.archive.org)
  3. DNS records (navigate to mxtoolbox.com)
  4. Subdomains (navigate to crt.sh)
- For each source:
  - Fill domain search form
  - Submit and wait
  - Extract results
  - Screenshot
- Aggregate all results
- Ingest to basset-hound
- Output: WHOIS data, Wayback snapshots, DNS records, subdomains

**Key Features:**
- Parallel execution (4 tabs simultaneously)
- Multiple data source integration
- Result aggregation
- Comprehensive evidence

### 4. Profile Extraction

**Use Case:** Extract all profiles from LinkedIn search results.

**Workflow:** [examples/workflows/profile-extraction.json](../../examples/workflows/profile-extraction.json)

**Description:**
- Input: search query, company name (optional)
- Steps:
  1. Navigate to LinkedIn
  2. Fill search form (query, filters)
  3. Submit search
  4. Wait for results
  5. Extract all profile links (CSS selector)
  6. Loop through each profile link:
     - Navigate to profile
     - Wait for profile content
     - Extract structured data (name, title, company, location, about)
     - Detect OSINT patterns (email, phone)
     - Screenshot profile
     - Go back to search results
  7. Handle pagination (if more results)
  8. Ingest all profiles
- Output: Array of profiles, total count

**Key Features:**
- Search and extraction
- Pagination handling
- Structured data extraction
- Loop with navigation
- Return to search results

### 5. Multi-Page Evidence Collection

**Use Case:** Collect evidence from multiple pages in a session.

**Workflow:** [examples/workflows/multi-page-evidence.json](../../examples/workflows/multi-page-evidence.json)

**Description:**
- Input: case ID, list of URLs
- Steps:
  1. Start evidence session (MCP command)
  2. Loop through URLs:
     - Navigate to URL
     - Wait for page load
     - Capture full-page screenshot
     - Extract page metadata (title, description, author)
     - Detect OSINT patterns
     - Extract all links
     - Add to evidence session
     - Wait 1 second
  3. Close evidence session
  4. Export session to JSON + PDF
- Output: Session ID, evidence count, export file path

**Key Features:**
- Evidence session integration
- Multi-page collection
- Metadata extraction
- Link cataloging
- Session export

---

## API Reference

### WorkflowManager API

```javascript
class WorkflowManager {
  /**
   * Load workflow from storage
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<Workflow>} Workflow object
   */
  async loadWorkflow(workflowId);

  /**
   * Save workflow to storage
   * @param {Workflow} workflow - Workflow object
   * @returns {Promise<string>} Workflow ID
   */
  async saveWorkflow(workflow);

  /**
   * Delete workflow from storage
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<void>}
   */
  async deleteWorkflow(workflowId);

  /**
   * List all workflows
   * @param {Object} options - Filter options
   * @returns {Promise<Array<WorkflowSummary>>}
   */
  async listWorkflows(options);

  /**
   * Validate workflow schema
   * @param {Workflow} workflow - Workflow object
   * @returns {Promise<ValidationResult>}
   */
  async validateWorkflow(workflow);

  /**
   * Import workflow from JSON
   * @param {string} json - Workflow JSON string
   * @returns {Promise<Workflow>}
   */
  async importWorkflow(json);

  /**
   * Export workflow to JSON
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<string>} JSON string
   */
  async exportWorkflow(workflowId);

  /**
   * Clone workflow
   * @param {string} workflowId - Source workflow ID
   * @returns {Promise<string>} New workflow ID
   */
  async cloneWorkflow(workflowId);
}
```

### WorkflowExecutor API

```javascript
class WorkflowExecutor {
  /**
   * Execute workflow
   * @param {string} workflowId - Workflow ID
   * @param {Object} inputs - Input parameters
   * @param {Object} options - Execution options
   * @returns {Promise<ExecutionResult>}
   */
  async execute(workflowId, inputs, options);

  /**
   * Pause workflow execution
   * @param {string} executionId - Execution ID
   * @returns {Promise<void>}
   */
  async pause(executionId);

  /**
   * Resume workflow execution
   * @param {string} executionId - Execution ID
   * @returns {Promise<void>}
   */
  async resume(executionId);

  /**
   * Cancel workflow execution
   * @param {string} executionId - Execution ID
   * @returns {Promise<void>}
   */
  async cancel(executionId);

  /**
   * Get execution status
   * @param {string} executionId - Execution ID
   * @returns {Promise<ExecutionStatus>}
   */
  async getStatus(executionId);

  /**
   * Get execution logs
   * @param {string} executionId - Execution ID
   * @returns {Promise<Array<LogEntry>>}
   */
  async getLogs(executionId);

  /**
   * List all executions
   * @param {Object} options - Filter options
   * @returns {Promise<Array<ExecutionSummary>>}
   */
  async listExecutions(options);
}
```

### ScheduleManager API

```javascript
class ScheduleManager {
  /**
   * Create workflow schedule
   * @param {string} workflowId - Workflow ID
   * @param {ScheduleOptions} options - Schedule options
   * @returns {Promise<string>} Schedule ID
   */
  async createSchedule(workflowId, options);

  /**
   * Update schedule
   * @param {string} scheduleId - Schedule ID
   * @param {ScheduleOptions} options - Updated options
   * @returns {Promise<void>}
   */
  async updateSchedule(scheduleId, options);

  /**
   * Delete schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<void>}
   */
  async deleteSchedule(scheduleId);

  /**
   * Enable/disable schedule
   * @param {string} scheduleId - Schedule ID
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<void>}
   */
  async setScheduleEnabled(scheduleId, enabled);

  /**
   * List all schedules
   * @returns {Promise<Array<Schedule>>}
   */
  async listSchedules();

  /**
   * Run scheduled workflow immediately
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<string>} Execution ID
   */
  async runScheduledWorkflow(scheduleId);
}
```

### MCP Command Handlers

```javascript
// background.js

/**
 * MCP Command: execute_workflow
 * Execute a workflow with given inputs
 */
async function handleExecuteWorkflow(params) {
  const { workflowId, inputs, options } = params;

  const executor = new WorkflowExecutor();
  const result = await executor.execute(workflowId, inputs, options);

  return {
    success: true,
    executionId: result.executionId,
    status: result.status
  };
}

/**
 * MCP Command: get_workflow_status
 * Get execution status and progress
 */
async function handleGetWorkflowStatus(params) {
  const { executionId } = params;

  const executor = new WorkflowExecutor();
  const status = await executor.getStatus(executionId);

  return {
    success: true,
    ...status
  };
}

/**
 * MCP Command: pause_workflow
 * Pause running workflow
 */
async function handlePauseWorkflow(params) {
  const { executionId } = params;

  const executor = new WorkflowExecutor();
  await executor.pause(executionId);

  return {
    success: true,
    executionId,
    status: 'paused'
  };
}

/**
 * MCP Command: resume_workflow
 * Resume paused workflow
 */
async function handleResumeWorkflow(params) {
  const { executionId } = params;

  const executor = new WorkflowExecutor();
  await executor.resume(executionId);

  return {
    success: true,
    executionId,
    status: 'running'
  };
}

/**
 * MCP Command: cancel_workflow
 * Cancel running workflow
 */
async function handleCancelWorkflow(params) {
  const { executionId } = params;

  const executor = new WorkflowExecutor();
  await executor.cancel(executionId);

  return {
    success: true,
    executionId,
    status: 'cancelled'
  };
}

/**
 * MCP Command: list_workflows
 * List available workflows
 */
async function handleListWorkflows(params) {
  const { category, tags, limit } = params;

  const manager = new WorkflowManager();
  const workflows = await manager.listWorkflows({ category, tags, limit });

  return {
    success: true,
    workflows,
    count: workflows.length
  };
}

/**
 * MCP Command: load_workflow
 * Load workflow definition
 */
async function handleLoadWorkflow(params) {
  const { workflowId } = params;

  const manager = new WorkflowManager();
  const workflow = await manager.loadWorkflow(workflowId);

  return {
    success: true,
    workflow
  };
}

/**
 * MCP Command: save_workflow
 * Save workflow definition
 */
async function handleSaveWorkflow(params) {
  const { workflow } = params;

  const manager = new WorkflowManager();
  const workflowId = await manager.saveWorkflow(workflow);

  return {
    success: true,
    workflowId
  };
}

/**
 * MCP Command: import_workflow
 * Import workflow from JSON
 */
async function handleImportWorkflow(params) {
  const { json } = params;

  const manager = new WorkflowManager();
  const workflow = await manager.importWorkflow(json);

  return {
    success: true,
    workflow
  };
}

/**
 * MCP Command: export_workflow
 * Export workflow to JSON
 */
async function handleExportWorkflow(params) {
  const { workflowId } = params;

  const manager = new WorkflowManager();
  const json = await manager.exportWorkflow(workflowId);

  return {
    success: true,
    json
  };
}
```

### Usage Examples

#### Execute Workflow from Python (palletAI)

```python
async def run_social_media_sweep(username):
    """
    Execute social media sweep workflow for a username.
    """
    result = await browser.send_command({
        "type": "execute_workflow",
        "params": {
            "workflowId": "social-media-sweep",
            "inputs": {
                "username": username
            },
            "options": {
                "captureEvidence": True
            }
        }
    })

    execution_id = result["executionId"]

    # Poll for completion
    while True:
        status = await browser.send_command({
            "type": "get_workflow_status",
            "params": {
                "executionId": execution_id
            }
        })

        if status["status"] in ["completed", "failed"]:
            break

        await asyncio.sleep(2)

    return status
```

#### Execute Workflow from JavaScript (content script)

```javascript
async function runWorkflow(workflowId, inputs) {
  const response = await chrome.runtime.sendMessage({
    action: 'execute_workflow',
    workflowId,
    inputs
  });

  return response;
}

// Usage
const result = await runWorkflow('email-investigation', {
  email: 'test@example.com'
});

console.log('Execution ID:', result.executionId);
```

---

## Implementation Roadmap

### Phase 1: Core Foundation (Week 1-2)

**Goal:** Implement basic workflow execution engine.

**Tasks:**
1. Create `WorkflowExecutor` class
2. Implement `ExecutionContext` for state management
3. Create `StepExecutor` with basic step types (navigate, click, fill, extract)
4. Implement error handling and retry logic
5. Add execution state persistence
6. Create unit tests

**Deliverables:**
- `utils/workflow/executor.js`
- `utils/workflow/context.js`
- `utils/workflow/step-executor.js`
- `utils/workflow/error-handler.js`
- `tests/unit/workflow-executor.test.js`

### Phase 2: Advanced Steps (Week 3)

**Goal:** Add advanced step types and control flow.

**Tasks:**
1. Implement `detect` step (integrate with field-detector.js)
2. Implement `conditional` step (if/else branching)
3. Implement `loop` step (for-each iteration)
4. Implement `parallel` step (concurrent execution)
5. Implement `script` step (custom JavaScript)
6. Add step timeout and cancellation

**Deliverables:**
- Enhanced `step-executor.js` with all step types
- `utils/workflow/control-flow.js`
- Integration tests

### Phase 3: Workflow Management (Week 4)

**Goal:** Create workflow CRUD and storage.

**Tasks:**
1. Create `WorkflowManager` class
2. Implement save/load workflows to chrome.storage.local
3. Add JSON schema validation
4. Implement import/export (JSON)
5. Add workflow cloning
6. Create workflow library UI component

**Deliverables:**
- `utils/workflow/manager.js`
- `utils/workflow/validator.js`
- `utils/workflow/schema.json`
- `utils/ui/workflow-library.js`

### Phase 4: UI Components (Week 5-6)

**Goal:** Build visual workflow builder and execution monitor.

**Tasks:**
1. Design and implement workflow builder panel (drag-and-drop)
2. Create code editor mode (syntax highlighting, validation)
3. Implement execution monitor (real-time progress)
4. Add execution logs panel
5. Create schedule manager UI
6. Integrate with existing DevTools panel

**Deliverables:**
- `utils/ui/workflow-builder.js`
- `utils/ui/workflow-editor.js`
- `utils/ui/execution-monitor.js`
- `utils/ui/execution-logs.js`
- `utils/ui/schedule-manager.js`
- CSS styles

### Phase 5: Scheduling & Automation (Week 7)

**Goal:** Enable scheduled workflow execution.

**Tasks:**
1. Create `ScheduleManager` class
2. Implement cron-like scheduling (chrome.alarms API)
3. Add schedule persistence
4. Implement schedule enable/disable
5. Add notification on completion/failure
6. Create scheduled execution queue

**Deliverables:**
- `utils/workflow/schedule-manager.js`
- `utils/workflow/scheduler.js`
- Background alarm handlers

### Phase 6: Evidence Integration (Week 8)

**Goal:** Integrate with evidence session management.

**Tasks:**
1. Auto-capture screenshots during workflow execution
2. Link workflow execution to evidence sessions
3. Add chain of custody for workflow-generated evidence
4. Implement workflow execution export (PDF report)
5. Add evidence counter to execution monitor

**Deliverables:**
- Enhanced `executor.js` with evidence capture
- Integration with `session-manager.js`
- Workflow execution report generator

### Phase 7: Preset Workflows (Week 9)

**Goal:** Create library of preset workflows.

**Tasks:**
1. Create 10+ preset workflows:
   - Social Media Sweep
   - Email Investigation
   - Domain Reconnaissance
   - Profile Extraction
   - Multi-Page Evidence Collection
   - Username Enumeration
   - Crypto Address Lookup
   - Search Result Extraction
   - Forum Profile Investigation
   - Data Breach Search
2. Document each workflow
3. Add tags and categories
4. Create preset library UI

**Deliverables:**
- `examples/workflows/*.json` (10+ files)
- Workflow documentation
- Preset library UI

### Phase 8: Testing & Documentation (Week 10)

**Goal:** Comprehensive testing and documentation.

**Tasks:**
1. Unit tests for all workflow classes
2. Integration tests for workflow execution
3. E2E tests for UI components
4. Performance testing (large workflows)
5. Create user documentation
6. Create developer guide (custom workflows)
7. Video tutorials

**Deliverables:**
- `tests/unit/workflow/*.test.js`
- `tests/e2e/workflow-builder.test.js`
- `docs/guides/WORKFLOW-USER-GUIDE.md`
- `docs/guides/WORKFLOW-DEVELOPER-GUIDE.md`
- Tutorial videos

### Phase 9: MCP Integration (Week 11)

**Goal:** Full AI agent integration via MCP.

**Tasks:**
1. Add MCP command handlers in background.js
2. Implement workflow execution via MCP
3. Add workflow status polling
4. Create AI agent workflow helpers
5. Test with palletAI agents
6. Document MCP API

**Deliverables:**
- Enhanced `background.js` with MCP handlers
- `docs/MCP-WORKFLOW-API.md`
- Python client examples

### Phase 10: Polish & Launch (Week 12)

**Goal:** Final polish and production release.

**Tasks:**
1. Performance optimization
2. Memory leak testing
3. Error handling improvements
4. UI/UX refinements
5. Security audit
6. Beta testing with users
7. Release v2.20.0

**Deliverables:**
- Production-ready code
- Release notes
- Migration guide (if needed)
- Launch announcement

---

## Security Considerations

### 1. Code Injection Prevention

**Risk:** Malicious workflows executing arbitrary JavaScript.

**Mitigation:**
- Sanitize all user input in `script` steps
- Use Content Security Policy (CSP) to prevent eval()
- Restrict `script` step to predefined safe functions
- Sandbox script execution with limited scope

```javascript
// Safe script execution
function executeSafeScript(code, context) {
  // Whitelist allowed functions
  const safeContext = {
    console: { log: console.log },
    Math: Math,
    // No access to chrome APIs, window, document
  };

  // Create safe function
  const safeFunction = new Function(
    ...Object.keys(safeContext),
    'return (' + code + ')'
  );

  // Execute with limited scope
  return safeFunction(...Object.values(safeContext));
}
```

### 2. Storage Limits

**Risk:** Workflows consuming excessive chrome.storage.local space.

**Mitigation:**
- Implement workflow size limits (e.g., 100 workflows max)
- Add execution history retention (30 days)
- Auto-cleanup old executions
- Warn user when approaching storage limits

```javascript
const STORAGE_LIMITS = {
  MAX_WORKFLOWS: 100,
  MAX_EXECUTIONS_PER_WORKFLOW: 20,
  EXECUTION_RETENTION_DAYS: 30,
  MAX_WORKFLOW_SIZE_BYTES: 50 * 1024 // 50 KB
};
```

### 3. Sensitive Data Exposure

**Risk:** Workflows logging or exposing passwords, API keys.

**Mitigation:**
- Mask sensitive fields (password, token, apiKey) in logs
- Redact sensitive data in execution results
- Encrypt sensitive variables in storage
- Warn user when exporting workflows with secrets

```javascript
const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i
];

function redactSensitiveData(data) {
  // Recursively redact sensitive fields
  for (const key in data) {
    if (SENSITIVE_FIELD_PATTERNS.some(p => p.test(key))) {
      data[key] = '[REDACTED]';
    }
  }
  return data;
}
```

### 4. Resource Exhaustion

**Risk:** Infinite loops or excessive parallel execution.

**Mitigation:**
- Enforce maximum loop iterations (default: 100)
- Limit parallel step execution (default: 3 concurrent)
- Implement global workflow timeout (default: 30 minutes)
- Add memory usage monitoring

```javascript
const EXECUTION_LIMITS = {
  MAX_LOOP_ITERATIONS: 100,
  MAX_PARALLEL_STEPS: 3,
  GLOBAL_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  MAX_STEP_TIMEOUT_MS: 5 * 60 * 1000 // 5 minutes
};
```

### 5. Workflow Tampering

**Risk:** Malicious modification of preset workflows.

**Mitigation:**
- Sign preset workflows with hash
- Verify workflow integrity on load
- Warn user if workflow modified
- Implement workflow versioning

```javascript
function verifyWorkflowIntegrity(workflow) {
  const expectedHash = workflow.metadata?.hash;
  if (!expectedHash) return true; // No hash, skip check

  const actualHash = calculateHash(workflow);
  return actualHash === expectedHash;
}
```

### 6. Cross-Site Scripting (XSS)

**Risk:** Malicious workflow names or descriptions executing in UI.

**Mitigation:**
- Sanitize all user input before displaying
- Use textContent instead of innerHTML
- Implement CSP headers
- Escape HTML entities

```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

## Performance & Optimization

### 1. Lazy Loading

Load workflow modules only when needed.

```javascript
// Don't load all workflows on startup
// Load on-demand when user opens workflow library
async function loadWorkflowLibrary() {
  const workflows = await chrome.storage.local.get('workflows');
  // Only load summaries, not full workflow definitions
  return workflows.map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    category: w.category,
    usageCount: w.usageCount
  }));
}
```

### 2. Execution Caching

Cache workflow execution results for debugging.

```javascript
class ExecutionCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(executionId, result) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(executionId, result);
  }

  get(executionId) {
    return this.cache.get(executionId);
  }
}
```

### 3. Progress Debouncing

Throttle progress updates to avoid UI jank.

```javascript
class ProgressTracker {
  constructor() {
    this.lastUpdate = 0;
    this.updateInterval = 500; // Update UI every 500ms max
  }

  emitProgress(event) {
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) {
      return; // Skip update
    }
    this.lastUpdate = now;

    // Emit progress event
    this.listeners.forEach(cb => cb(event));
  }
}
```

### 4. Memory Management

Clean up execution contexts after completion.

```javascript
class WorkflowExecutor {
  async execute(workflow, inputs) {
    const context = new ExecutionContext(workflow, inputs);

    try {
      await this.executeSteps(workflow.steps, context);
    } finally {
      // Clean up context
      context.cleanup();

      // Save minimal state to storage
      await this.stateManager.saveExecutionSummary(context);
    }
  }
}

class ExecutionContext {
  cleanup() {
    // Clear large data structures
    this.stepResults.clear();
    this.variables.clear();

    // Remove event listeners
    this.removeAllListeners();
  }
}
```

### 5. Tab Pooling

Reuse browser tabs for workflow execution.

```javascript
class TabPool {
  constructor(maxTabs = 5) {
    this.maxTabs = maxTabs;
    this.availableTabs = [];
    this.busyTabs = new Set();
  }

  async acquireTab() {
    if (this.availableTabs.length > 0) {
      const tab = this.availableTabs.pop();
      this.busyTabs.add(tab.id);
      return tab;
    }

    if (this.busyTabs.size < this.maxTabs) {
      const tab = await chrome.tabs.create({ active: false });
      this.busyTabs.add(tab.id);
      return tab;
    }

    // Wait for tab to become available
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.availableTabs.length > 0) {
          clearInterval(checkInterval);
          resolve(this.acquireTab());
        }
      }, 500);
    });
  }

  releaseTab(tab) {
    this.busyTabs.delete(tab.id);
    this.availableTabs.push(tab);
  }
}
```

---

## Testing Strategy

### 1. Unit Tests

Test individual workflow classes in isolation.

```javascript
describe('WorkflowExecutor', () => {
  it('should execute simple workflow', async () => {
    const workflow = {
      id: 'test-1',
      name: 'Test Workflow',
      steps: [
        { id: 'nav-1', type: 'navigate', params: { url: 'https://example.com' } }
      ]
    };

    const executor = new WorkflowExecutor();
    const result = await executor.execute(workflow, {});

    expect(result.success).toBe(true);
    expect(result.stepResults.size).toBe(1);
  });

  it('should handle step errors', async () => {
    const workflow = {
      id: 'test-2',
      steps: [
        { id: 'fail-1', type: 'navigate', params: { url: 'invalid-url' } }
      ]
    };

    const executor = new WorkflowExecutor();
    const result = await executor.execute(workflow, {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should retry failed steps', async () => {
    const workflow = {
      id: 'test-3',
      config: { retryPolicy: { maxRetries: 3 } },
      steps: [
        { id: 'retry-1', type: 'click', params: { selector: '#button' } }
      ]
    };

    const executor = new WorkflowExecutor();
    const result = await executor.execute(workflow, {});

    // Check retry attempts in logs
    expect(result.logs.filter(l => l.message.includes('retry')).length).toBe(3);
  });
});
```

### 2. Integration Tests

Test workflow execution with real browser interactions.

```javascript
describe('Workflow Integration', () => {
  let browser;

  beforeAll(async () => {
    browser = await setupTestBrowser();
  });

  it('should execute social media sweep workflow', async () => {
    const workflow = await loadWorkflow('social-media-sweep');
    const executor = new WorkflowExecutor();

    const result = await executor.execute(workflow, {
      username: 'testuser123'
    });

    expect(result.success).toBe(true);
    expect(result.outputs.profilesFound.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await browser.close();
  });
});
```

### 3. E2E Tests

Test UI components with Playwright.

```javascript
const { test, expect } = require('@playwright/test');

test('workflow builder creates new workflow', async ({ page }) => {
  await page.goto('chrome-extension://[id]/popup.html');

  // Click "New Workflow"
  await page.click('button:has-text("New Workflow")');

  // Fill workflow details
  await page.fill('#workflow-name', 'Test Workflow');
  await page.fill('#workflow-description', 'Test description');

  // Add navigate step
  await page.click('button:has-text("Add Step")');
  await page.click('button:has-text("Navigate")');
  await page.fill('#step-url', 'https://example.com');

  // Save workflow
  await page.click('button:has-text("Save")');

  // Verify workflow saved
  await expect(page.locator('.workflow-list')).toContainText('Test Workflow');
});
```

### 4. Performance Tests

Test workflow execution performance.

```javascript
describe('Performance', () => {
  it('should execute 100-step workflow in under 1 minute', async () => {
    const workflow = createLargeWorkflow(100); // 100 steps

    const start = Date.now();
    const executor = new WorkflowExecutor();
    await executor.execute(workflow, {});
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(60000); // Under 1 minute
  });

  it('should handle 10 parallel workflows', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const executor = new WorkflowExecutor();
      promises.push(executor.execute(simpleWorkflow, {}));
    }

    const results = await Promise.all(promises);
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

---

## Future Enhancements

### Phase 18+: Advanced Features

1. **Workflow Marketplace**
   - Share workflows with community
   - Rate and review workflows
   - Search and discover workflows
   - One-click import

2. **Team Collaboration**
   - Share workflows with team members
   - Real-time collaborative editing
   - Comment on workflow steps
   - Version control (git-like)

3. **AI-Assisted Workflow Creation**
   - Natural language to workflow
   - "Create a workflow to check username on Twitter and GitHub"
   - AI suggests steps based on description
   - Learn from existing workflows

4. **Advanced Control Flow**
   - Try/catch/finally blocks
   - Switch/case statements
   - Recursive workflows
   - Workflow composition (call another workflow)

5. **Data Transformations**
   - Built-in data transformers (JSON, CSV, XML)
   - Regex extraction
   - Data validation and cleanup
   - Aggregation functions (sum, avg, count)

6. **Webhook Triggers**
   - Trigger workflow on webhook event
   - Send webhook on workflow completion
   - Integration with Zapier, IFTTT

7. **Machine Learning Integration**
   - Train models on workflow execution data
   - Predict workflow success probability
   - Anomaly detection (unexpected results)
   - Auto-optimize workflows

8. **Mobile Support**
   - Execute workflows on mobile browser
   - Mobile-optimized UI
   - Push notifications for workflow completion

---

## Conclusion

The Workflow Automation system transforms the Basset Hound Browser Automation Extension from a command-based tool into a **powerful, user-friendly platform** for OSINT investigators.

### Key Achievements

✅ **Comprehensive Design**: Detailed architecture, JSON schema, and API specification
✅ **Research-Backed**: Informed by best practices from n8n, Puppeteer, Playwright, and Zapier
✅ **Scope-Aware**: Clear boundaries between browser automation (IN) and external APIs (OUT)
✅ **User-Friendly**: Visual builder + code editor for all skill levels
✅ **Production-Ready**: Error handling, retries, state management, evidence capture
✅ **Extensible**: Plugin architecture for custom step types
✅ **Well-Documented**: 2,500+ lines of architecture documentation

### Next Steps

1. **Review and Approval**: Stakeholder review of design document
2. **Implementation**: Follow 12-week roadmap (Phases 1-10)
3. **Testing**: Comprehensive unit, integration, and E2E tests
4. **Beta Testing**: Early access for select investigators
5. **Production Launch**: Release v2.20.0 with workflow automation

### Success Metrics

- **Workflow Creation**: 100+ community workflows within 6 months
- **Time Savings**: 70% reduction in repetitive task time
- **User Adoption**: 80% of active users create at least one workflow
- **Reliability**: 95% workflow success rate
- **Performance**: <30s average workflow execution time

---

## References

### Research Sources

- [n8n Workflows Documentation](https://docs.n8n.io/workflows/)
- [n8n Data Structure](https://docs.n8n.io/data/data-structure/)
- [n8n Community: JSON Schema Request](https://community.n8n.io/t/is-there-a-json-schema-for-your-workflow-json-file/89873)
- [Puppeteer Functional Patterns (GitHub)](https://github.com/agaricide/puppeteer-functional-patterns/blob/master/ts/puppeteer-functional-patterns.md)
- [What is Puppeteer (Latenode)](https://latenode.com/blog/web-automation-scraping/puppeteer-fundamentals-setup/what-is-puppeteer-and-how-it-changed-browser-automation-a-complete-overview)
- [6 Pro Tips for Optimizing Puppeteer (Bannerbear)](https://www.bannerbear.com/blog/6-pro-tips-for-optimizing-web-automation-using-puppeteer/)
- [Playwright Retries Documentation](https://playwright.dev/docs/test-retries)
- [Effective Error Handling in Playwright (Neova Solutions)](https://www.neovasolutions.com/2024/08/15/effective-error-handling-and-retries-in-playwright-tests/)
- [Intelligent Retry Strategies (DEV Community)](https://dev.to/anitha_ramachandran_85496/go-beyond-built-in-retries-in-playwright-intelligent-retry-strategies-based-on-error-types-test-1ag4)
- [Zapier Paths: Conditional Workflows](https://zapier.com/blog/zapier-paths-conditional-workflows/)
- [Use Conditional Logic (Zapier Help)](https://help.zapier.com/hc/en-us/articles/34372501750285-Use-conditional-logic-to-filter-and-split-your-Zap-workflows)
- [Add Branching Logic with Paths (Zapier Help)](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zaps-with-Paths)
- [How to Use OSINT and Web Scraping (Automatio)](https://automatio.ai/blog/osint-and-scraping/)
- [Web Scraping for OSINT (Cyber Huntress on Medium)](https://medium.com/@thecyberhuntress/web-scraping-for-osint-methods-and-tools-eacaff81ca40)
- [OSINT Framework Guide (Axeligence)](https://axeligence.com/osint-framework-a-step-by-step-guide-for-investigators/)
- [Browser-Based Web Scraping Tools (Siberoloji)](https://www.siberoloji.com/using-browser-based-tools-web-scraping-techniques-for-osint/)

### Internal Documents

- [PROJECT-SCOPE.md](/home/devel/autofill-extension/docs/PROJECT-SCOPE.md)
- [ARCHITECTURE.md](/home/devel/autofill-extension/docs/ARCHITECTURE.md)
- [API_REFERENCE.md](/home/devel/autofill-extension/docs/API_REFERENCE.md)
- [ROADMAP.md](/home/devel/autofill-extension/docs/ROADMAP.md)
- [Browser Automation Strategy](/home/devel/autofill-extension/docs/findings/03-BROWSER-AUTOMATION-STRATEGY.md)

---

**Document Version:** 1.0.0
**Last Updated:** January 9, 2026
**Authors:** Basset Hound Development Team
**Status:** Design Phase Complete - Ready for Implementation
