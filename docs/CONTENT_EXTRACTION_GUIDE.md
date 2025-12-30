# Content Extraction Guide

Comprehensive guide for using the Basset Hound advanced content extraction features.

## Table of Contents

- [Overview](#overview)
- [Commands](#commands)
  - [extract_tables](#extract_tables)
  - [extract_links](#extract_links)
  - [extract_images](#extract_images)
  - [extract_structured_data](#extract_structured_data)
  - [extract_metadata](#extract_metadata)
  - [extract_text_content](#extract_text_content)
  - [download_resources](#download_resources)
- [Use Cases](#use-cases)
- [Examples](#examples)
- [Integration](#integration)
- [Best Practices](#best-practices)

## Overview

The Content Extraction features provide powerful tools for extracting structured and unstructured data from web pages. These commands go beyond simple scraping to provide:

- HTML table extraction with structured data
- Link analysis and metadata extraction
- Image discovery with attributes
- Structured data parsing (JSON-LD, Microdata, RDFa)
- Comprehensive metadata extraction (Open Graph, Twitter Cards)
- Clean text extraction without HTML
- Resource downloading capabilities

All extraction happens in the context of the loaded page, with full access to the DOM.

## Commands

### extract_tables

Extract all HTML tables from the page with structured data.

**Command:**
```json
{
  "command_id": "cmd_201",
  "type": "extract_tables",
  "params": {
    "selector": "table",
    "includeHeaders": true,
    "parseNumbers": true,
    "minRows": 2,
    "maxTables": 10
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | No | CSS selector for tables (default: 'table') |
| `includeHeaders` | boolean | No | Include table headers (default: true) |
| `parseNumbers` | boolean | No | Try to parse numeric values (default: false) |
| `minRows` | number | No | Minimum rows to include table (default: 0) |
| `maxTables` | number | No | Maximum tables to extract (default: all) |

**Response:**
```json
{
  "success": true,
  "tables": [
    {
      "index": 0,
      "id": "users-table",
      "className": "data-table",
      "headers": ["Name", "Email", "Status"],
      "rows": [
        ["John Doe", "john@example.com", "Active"],
        ["Jane Smith", "jane@example.com", "Inactive"]
      ],
      "rowCount": 2,
      "columnCount": 3,
      "caption": "User List",
      "summary": null
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### extract_links

Extract all links from the page with comprehensive metadata.

**Command:**
```json
{
  "command_id": "cmd_202",
  "type": "extract_links",
  "params": {
    "selector": "a[href]",
    "includeInternal": true,
    "includeExternal": true,
    "includeAnchors": false,
    "attributes": ["data-id", "data-category"],
    "maxLinks": 100
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | No | CSS selector for links (default: 'a[href]') |
| `includeInternal` | boolean | No | Include internal links (default: true) |
| `includeExternal` | boolean | No | Include external links (default: true) |
| `includeAnchors` | boolean | No | Include anchor links (default: true) |
| `attributes` | array | No | Additional attributes to extract |
| `maxLinks` | number | No | Maximum links to extract |

**Response:**
```json
{
  "success": true,
  "links": [
    {
      "href": "https://example.com/about",
      "text": "About Us",
      "title": "Learn more about us",
      "target": "_blank",
      "rel": "noopener",
      "type": "internal",
      "protocol": "https",
      "domain": "example.com"
    }
  ],
  "count": 42,
  "grouped": {
    "internal": 30,
    "external": 10,
    "anchor": 2,
    "other": 0
  },
  "groupedLinks": {
    "internal": [...],
    "external": [...],
    "anchor": [...],
    "other": [...]
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### extract_images

Extract all images with metadata and attributes.

**Command:**
```json
{
  "command_id": "cmd_203",
  "type": "extract_images",
  "params": {
    "selector": "img",
    "includeDataUrls": false,
    "includeDimensions": true,
    "attributes": ["data-original", "loading"],
    "maxImages": 50
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | No | CSS selector for images (default: 'img') |
| `includeDataUrls` | boolean | No | Include data URLs (default: false) |
| `includeDimensions` | boolean | No | Include image dimensions (default: true) |
| `attributes` | array | No | Additional attributes to extract |
| `maxImages` | number | No | Maximum images to extract |

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "src": "https://example.com/images/logo.png",
      "alt": "Company Logo",
      "title": "Our Logo",
      "loading": "lazy",
      "crossOrigin": null,
      "width": 200,
      "height": 100,
      "naturalWidth": 400,
      "naturalHeight": 200,
      "srcset": "logo-2x.png 2x, logo-3x.png 3x",
      "sizes": "(max-width: 600px) 100vw, 200px"
    }
  ],
  "count": 15,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### extract_structured_data

Extract structured data from the page (JSON-LD, Microdata, RDFa).

**Command:**
```json
{
  "command_id": "cmd_204",
  "type": "extract_structured_data",
  "params": {
    "includeJsonLd": true,
    "includeMicrodata": true,
    "includeRdfa": true
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeJsonLd` | boolean | No | Include JSON-LD (default: true) |
| `includeMicrodata` | boolean | No | Include Microdata (default: true) |
| `includeRdfa` | boolean | No | Include RDFa (default: true) |

**Response:**
```json
{
  "success": true,
  "structuredData": {
    "jsonLd": [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Example Corp",
        "url": "https://example.com"
      }
    ],
    "microdata": [
      {
        "type": "http://schema.org/Product",
        "properties": {
          "name": "Widget",
          "price": "19.99"
        }
      }
    ],
    "rdfa": [
      {
        "type": "http://schema.org/Article",
        "property": "headline",
        "content": "Breaking News"
      }
    ]
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### extract_metadata

Extract comprehensive metadata from the page including meta tags, Open Graph, and Twitter Cards.

**Command:**
```json
{
  "command_id": "cmd_205",
  "type": "extract_metadata",
  "params": {
    "includeStandard": true,
    "includeOpenGraph": true,
    "includeTwitter": true,
    "includeDublinCore": true
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeStandard` | boolean | No | Include standard meta tags (default: true) |
| `includeOpenGraph` | boolean | No | Include Open Graph tags (default: true) |
| `includeTwitter` | boolean | No | Include Twitter Card tags (default: true) |
| `includeDublinCore` | boolean | No | Include Dublin Core tags (default: true) |

**Response:**
```json
{
  "success": true,
  "metadata": {
    "title": "Example Page - Company Name",
    "url": "https://example.com/page",
    "baseUrl": "https://example.com/",
    "charset": "UTF-8",
    "lang": "en",
    "standard": {
      "description": "This is an example page",
      "keywords": "example, demo, test",
      "author": "Example Corp",
      "viewport": "width=device-width, initial-scale=1"
    },
    "openGraph": {
      "title": "Example Page",
      "description": "This is an example page",
      "image": "https://example.com/og-image.jpg",
      "url": "https://example.com/page",
      "type": "website",
      "site_name": "Example Corp"
    },
    "twitter": {
      "card": "summary_large_image",
      "site": "@example",
      "title": "Example Page",
      "description": "This is an example page",
      "image": "https://example.com/twitter-image.jpg"
    },
    "dublinCore": {
      "title": "Example Page",
      "creator": "Example Corp",
      "date": "2024-01-15"
    },
    "links": {
      "canonical": [
        {
          "href": "https://example.com/page",
          "type": null,
          "sizes": null,
          "media": null
        }
      ],
      "alternate": [...],
      "icon": [...]
    }
  },
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### extract_text_content

Extract clean text content without HTML markup.

**Command:**
```json
{
  "command_id": "cmd_206",
  "type": "extract_text_content",
  "params": {
    "selector": "body",
    "preserveWhitespace": false,
    "includeHidden": false,
    "excludeSelectors": ["script", "style", "nav", "footer"],
    "maxLength": 10000
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `selector` | string | No | CSS selector for content (default: 'body') |
| `preserveWhitespace` | boolean | No | Preserve whitespace (default: false) |
| `includeHidden` | boolean | No | Include hidden elements (default: false) |
| `excludeSelectors` | array | No | Selectors to exclude (default: ['script', 'style', 'noscript']) |
| `maxLength` | number | No | Maximum text length |

**Response:**
```json
{
  "success": true,
  "text": "This is the clean text content from the page without any HTML tags or markup.",
  "length": 85,
  "wordCount": 16,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### download_resources

Download page resources (images, CSS, JS files).

**Command:**
```json
{
  "command_id": "cmd_207",
  "type": "download_resources",
  "params": {
    "types": ["images", "css", "js"],
    "urlPattern": ".*example\\.com.*",
    "maxSize": 5242880,
    "maxResources": 50
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `types` | array | No | Resource types: 'images', 'css', 'js' (default: ['images', 'css', 'js']) |
| `urlPattern` | string | No | Filter resources by URL pattern (regex) |
| `maxSize` | number | No | Maximum file size in bytes |
| `maxResources` | number | No | Maximum resources to download (default: 100) |

**Response:**
```json
{
  "success": true,
  "downloaded": [
    {
      "type": "image",
      "url": "https://example.com/logo.png",
      "filename": "logo.png",
      "size": 15234,
      "downloadId": 123
    }
  ],
  "failed": [
    {
      "type": "image",
      "url": "https://example.com/missing.png",
      "filename": "missing.png",
      "error": "404 Not Found"
    }
  ],
  "totalResources": 25,
  "downloadedCount": 23,
  "failedCount": 2,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

## Use Cases

### 1. Data Mining from Tables

Extract structured data from HTML tables:

```python
result = await client.send_command({
    "type": "extract_tables",
    "params": {
        "selector": "table.data-table",
        "parseNumbers": True,
        "minRows": 1
    }
})

for table in result["tables"]:
    print(f"Table: {table['caption']}")
    print(f"Headers: {table['headers']}")
    for row in table["rows"]:
        print(f"  {row}")
```

### 2. Link Analysis and Crawling

Build a site map or identify external dependencies:

```python
result = await client.send_command({
    "type": "extract_links",
    "params": {
        "includeExternal": True
    }
})

print(f"Total links: {result['count']}")
print(f"Internal: {result['grouped']['internal']}")
print(f"External: {result['grouped']['external']}")

# Extract external domains
external_domains = set()
for link in result["groupedLinks"]["external"]:
    external_domains.add(link["domain"])

print(f"External domains: {external_domains}")
```

### 3. SEO Analysis

Extract and analyze page metadata:

```python
metadata = await client.send_command({
    "type": "extract_metadata"
})

# Check for essential SEO elements
meta = metadata["metadata"]
issues = []

if not meta.get("standard", {}).get("description"):
    issues.append("Missing meta description")

if not meta.get("openGraph", {}).get("image"):
    issues.append("Missing OG image")

if not meta.get("links", {}).get("canonical"):
    issues.append("Missing canonical URL")

if issues:
    print("SEO Issues:")
    for issue in issues:
        print(f"  - {issue}")
```

### 4. Content Aggregation

Extract clean text for analysis or indexing:

```python
text = await client.send_command({
    "type": "extract_text_content",
    "params": {
        "selector": "article",
        "excludeSelectors": ["script", "style", "nav", "footer", "aside"]
    }
})

print(f"Article length: {text['length']} characters")
print(f"Word count: {text['wordCount']} words")
print(f"Content: {text['text'][:200]}...")
```

### 5. Structured Data Validation

Verify schema.org markup:

```python
data = await client.send_command({
    "type": "extract_structured_data",
    "params": {
        "includeJsonLd": True
    }
})

for item in data["structuredData"]["jsonLd"]:
    print(f"Type: {item.get('@type')}")
    print(f"Schema: {item}")
```

### 6. Image Inventory

Catalog all images on a page:

```python
images = await client.send_command({
    "type": "extract_images",
    "params": {
        "includeDimensions": True,
        "includeDataUrls": False
    }
})

print(f"Total images: {images['count']}")

# Find images without alt text
no_alt = [img for img in images["images"] if not img["alt"]]
print(f"Images without alt text: {len(no_alt)}")

# Find large images
large_images = [
    img for img in images["images"]
    if img["naturalWidth"] and img["naturalWidth"] > 1920
]
print(f"Large images (>1920px): {len(large_images)}")
```

## Examples

### Example 1: Complete Page Analysis

```python
async def analyze_page(url):
    # Navigate to page
    await client.send_command({
        "type": "navigate",
        "params": {"url": url}
    })

    # Wait for page load
    await asyncio.sleep(2)

    # Extract all data types
    results = {}

    # Tables
    results["tables"] = await client.send_command({"type": "extract_tables"})

    # Links
    results["links"] = await client.send_command({"type": "extract_links"})

    # Images
    results["images"] = await client.send_command({"type": "extract_images"})

    # Metadata
    results["metadata"] = await client.send_command({"type": "extract_metadata"})

    # Structured data
    results["structured"] = await client.send_command({"type": "extract_structured_data"})

    # Text content
    results["text"] = await client.send_command({"type": "extract_text_content"})

    # Generate report
    print(f"Page Analysis: {url}")
    print(f"  Tables: {results['tables']['count']}")
    print(f"  Links: {results['links']['count']}")
    print(f"  Images: {results['images']['count']}")
    print(f"  Text length: {results['text']['length']} chars")
    print(f"  Has JSON-LD: {len(results['structured']['structuredData'].get('jsonLd', [])) > 0}")

    return results

# Run analysis
analysis = await analyze_page("https://example.com")
```

### Example 2: Price Comparison Scraper

```python
async def scrape_product_prices(url):
    await client.send_command({
        "type": "navigate",
        "params": {"url": url}
    })

    # Extract price table
    tables = await client.send_command({
        "type": "extract_tables",
        "params": {
            "selector": "table.price-table",
            "parseNumbers": True
        }
    })

    # Extract structured product data
    structured = await client.send_command({
        "type": "extract_structured_data",
        "params": {"includeJsonLd": True}
    })

    # Parse prices
    prices = []
    for table in tables["tables"]:
        for row in table["rows"]:
            # Assuming format: [Product, Price, Availability]
            if len(row) >= 2:
                prices.append({
                    "product": row[0],
                    "price": row[1],
                    "source": url
                })

    # Also check structured data
    for item in structured["structuredData"].get("jsonLd", []):
        if item.get("@type") == "Product":
            prices.append({
                "product": item.get("name"),
                "price": item.get("offers", {}).get("price"),
                "currency": item.get("offers", {}).get("priceCurrency"),
                "source": url
            })

    return prices

# Scrape multiple sites
sites = [
    "https://retailer1.com/product",
    "https://retailer2.com/product",
    "https://retailer3.com/product"
]

all_prices = []
for site in sites:
    prices = await scrape_product_prices(site)
    all_prices.extend(prices)

# Find best price
all_prices.sort(key=lambda x: float(x["price"]) if x["price"] else float('inf'))
print(f"Best price: {all_prices[0]}")
```

### Example 3: Social Media Analysis

```python
async def analyze_social_sharing(url):
    await client.send_command({
        "type": "navigate",
        "params": {"url": url}
    })

    # Extract metadata
    metadata = await client.send_command({
        "type": "extract_metadata",
        "params": {
            "includeOpenGraph": True,
            "includeTwitter": True
        }
    })

    meta = metadata["metadata"]

    # Check social media optimization
    analysis = {
        "url": url,
        "title": meta["title"],
        "has_og_image": bool(meta.get("openGraph", {}).get("image")),
        "has_twitter_card": bool(meta.get("twitter", {}).get("card")),
        "og_complete": all([
            meta.get("openGraph", {}).get("title"),
            meta.get("openGraph", {}).get("description"),
            meta.get("openGraph", {}).get("image"),
            meta.get("openGraph", {}).get("url")
        ]),
        "twitter_complete": all([
            meta.get("twitter", {}).get("card"),
            meta.get("twitter", {}).get("title"),
            meta.get("twitter", {}).get("description"),
            meta.get("twitter", {}).get("image")
        ])
    }

    # Extract social links
    links = await client.send_command({
        "type": "extract_links",
        "params": {"includeExternal": True}
    })

    social_domains = ["facebook.com", "twitter.com", "linkedin.com", "instagram.com"]
    social_links = [
        link for link in links["links"]
        if any(domain in link["domain"] for domain in social_domains)
    ]

    analysis["social_links"] = len(social_links)
    analysis["social_platforms"] = list(set([
        link["domain"] for link in social_links
    ]))

    return analysis

# Analyze page
result = await analyze_social_sharing("https://example.com/article")
print(f"Social Media Analysis:")
print(f"  Open Graph complete: {result['og_complete']}")
print(f"  Twitter Card complete: {result['twitter_complete']}")
print(f"  Social links: {result['social_links']}")
print(f"  Platforms: {result['social_platforms']}")
```

### Example 4: Content Migration

```python
async def export_page_content(url, output_dir):
    import os
    import json

    await client.send_command({
        "type": "navigate",
        "params": {"url": url}
    })

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Extract all content
    content = {}

    # Text content
    text = await client.send_command({
        "type": "extract_text_content",
        "params": {"selector": "article"}
    })
    content["text"] = text["text"]

    # Images
    images = await client.send_command({
        "type": "extract_images"
    })
    content["images"] = images["images"]

    # Links
    links = await client.send_command({
        "type": "extract_links"
    })
    content["links"] = links["links"]

    # Metadata
    metadata = await client.send_command({
        "type": "extract_metadata"
    })
    content["metadata"] = metadata["metadata"]

    # Tables
    tables = await client.send_command({
        "type": "extract_tables"
    })
    content["tables"] = tables["tables"]

    # Save content as JSON
    with open(os.path.join(output_dir, "content.json"), "w") as f:
        json.dump(content, f, indent=2)

    # Download images
    if images["images"]:
        await client.send_command({
            "type": "download_resources",
            "params": {
                "types": ["images"],
                "maxResources": 100
            }
        })

    print(f"Exported content to {output_dir}")
    print(f"  Text: {text['wordCount']} words")
    print(f"  Images: {len(images['images'])}")
    print(f"  Links: {len(links['links'])}")
    print(f"  Tables: {len(tables['tables'])}")

    return content

# Export page
await export_page_content("https://example.com/article", "./exports/article1")
```

## Integration

### With Data Pipeline

Combine extraction with normalization and entity management:

```python
# Extract product data
structured = await client.send_command({
    "type": "extract_structured_data"
})

# Normalize and create entity
for product in structured["structuredData"]["jsonLd"]:
    if product.get("@type") == "Product":
        await client.send_command({
            "type": "create_entity",
            "params": {
                "type": "product",
                "data": {
                    "name": product.get("name"),
                    "price": product.get("offers", {}).get("price"),
                    "description": product.get("description"),
                    "url": product.get("url")
                }
            }
        })
```

### With Network Monitoring

Track resources while extracting:

```python
# Start network monitoring
await client.send_command({"type": "start_network_capture"})

# Navigate and extract
await client.send_command({"type": "navigate", "params": {"url": url}})
content = await client.send_command({"type": "extract_text_content"})

# Get network summary
network = await client.send_command({"type": "get_network_summary"})

# Combine results
result = {
    "content": content,
    "total_requests": network["summary"]["overview"]["totalRequests"],
    "page_load_time": network["summary"]["overview"]["durationMs"]
}
```

## Best Practices

### 1. Use Specific Selectors

Target specific elements for better performance:

```json
{
  "type": "extract_tables",
  "params": {
    "selector": "table.data-table",
    "minRows": 1
  }
}
```

### 2. Filter Early

Reduce data volume with filters:

```json
{
  "type": "extract_links",
  "params": {
    "includeExternal": false,
    "maxLinks": 50
  }
}
```

### 3. Exclude Unnecessary Elements

Remove noise from text extraction:

```json
{
  "type": "extract_text_content",
  "params": {
    "excludeSelectors": ["script", "style", "nav", "footer", "aside", "header"]
  }
}
```

### 4. Parse Numbers When Needed

Enable number parsing for numeric data:

```json
{
  "type": "extract_tables",
  "params": {
    "parseNumbers": true
  }
}
```

### 5. Limit Resource Downloads

Be conservative with downloads:

```json
{
  "type": "download_resources",
  "params": {
    "types": ["images"],
    "maxResources": 20,
    "maxSize": 1048576
  }
}
```

### 6. Validate Extracted Data

Always check for missing or invalid data:

```python
result = await client.send_command({"type": "extract_metadata"})

if not result.get("success"):
    print(f"Extraction failed: {result.get('error')}")
else:
    metadata = result["metadata"]
    if not metadata.get("title"):
        print("Warning: No title found")
```

### 7. Handle Multiple Data Formats

Check all structured data formats:

```python
structured = await client.send_command({
    "type": "extract_structured_data"
})

data = structured["structuredData"]

# Check JSON-LD first (most common)
if data.get("jsonLd"):
    process_jsonld(data["jsonLd"])
# Fall back to Microdata
elif data.get("microdata"):
    process_microdata(data["microdata"])
# Finally try RDFa
elif data.get("rdfa"):
    process_rdfa(data["rdfa"])
```

### 8. Preserve Context

Include metadata with extracted content:

```python
async def extract_with_context(url):
    # Navigate
    await client.send_command({"type": "navigate", "params": {"url": url}})

    # Extract content
    content = await client.send_command({"type": "extract_text_content"})

    # Extract metadata for context
    metadata = await client.send_command({"type": "extract_metadata"})

    # Combine
    return {
        "url": url,
        "title": metadata["metadata"]["title"],
        "content": content["text"],
        "extracted_at": content["timestamp"],
        "word_count": content["wordCount"]
    }
```

## Advanced Techniques

### Dynamic Content Extraction

Wait for dynamic content to load:

```python
# Navigate
await client.send_command({"type": "navigate", "params": {"url": url}})

# Wait for specific element
await client.send_command({
    "type": "wait_for_element",
    "params": {"selector": "table.dynamic-data", "timeout": 5000}
})

# Extract
tables = await client.send_command({"type": "extract_tables"})
```

### Recursive Link Extraction

Build a sitemap by following links:

```python
async def build_sitemap(start_url, max_depth=3, visited=None):
    if visited is None:
        visited = set()

    if start_url in visited or max_depth == 0:
        return []

    visited.add(start_url)

    # Navigate and extract links
    await client.send_command({"type": "navigate", "params": {"url": start_url}})
    result = await client.send_command({
        "type": "extract_links",
        "params": {"includeInternal": True, "includeExternal": False}
    })

    pages = [start_url]

    # Recursively visit internal links
    for link in result["groupedLinks"]["internal"]:
        if link["href"] not in visited:
            sub_pages = await build_sitemap(link["href"], max_depth - 1, visited)
            pages.extend(sub_pages)

    return pages

# Build sitemap
sitemap = await build_sitemap("https://example.com", max_depth=2)
print(f"Found {len(sitemap)} pages")
```

### Comparative Analysis

Compare content across pages:

```python
async def compare_pages(url1, url2):
    results = {}

    for url in [url1, url2]:
        await client.send_command({"type": "navigate", "params": {"url": url}})

        metadata = await client.send_command({"type": "extract_metadata"})
        text = await client.send_command({"type": "extract_text_content"})
        images = await client.send_command({"type": "extract_images"})
        links = await client.send_command({"type": "extract_links"})

        results[url] = {
            "title": metadata["metadata"]["title"],
            "word_count": text["wordCount"],
            "image_count": images["count"],
            "link_count": links["count"]
        }

    # Compare
    print("Comparison:")
    for key in results[url1].keys():
        print(f"  {key}:")
        print(f"    {url1}: {results[url1][key]}")
        print(f"    {url2}: {results[url2][key]}")

# Compare
await compare_pages("https://example.com/v1", "https://example.com/v2")
```

## Troubleshooting

### No Data Extracted

Check if selector matches elements:
```python
# Use get_content first to verify
test = await client.send_command({
    "type": "get_content",
    "params": {"selector": "table"}
})
```

### Text Extraction Too Verbose

Exclude more selectors:
```json
{
  "type": "extract_text_content",
  "params": {
    "excludeSelectors": ["script", "style", "nav", "footer", "aside", "header", "form"]
  }
}
```

### Missing Structured Data

Try different formats:
```json
{
  "type": "extract_structured_data",
  "params": {
    "includeJsonLd": true,
    "includeMicrodata": true,
    "includeRdfa": true
  }
}
```

### Downloads Failing

Check permissions and file sizes:
- Ensure `downloads` permission in manifest
- Check `maxSize` parameter
- Verify URLs are accessible

## Related Documentation

- [Network Export Guide](./NETWORK_EXPORT_GUIDE.md)
- [Form Automation Guide](./FORM_AUTOMATION_GUIDE.md)
- [Data Pipeline Guide](./DATA_PIPELINE_GUIDE.md)

## Support

For issues, questions, or feature requests, please refer to the main project documentation or submit an issue on the project repository.
