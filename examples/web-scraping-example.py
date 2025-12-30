#!/usr/bin/env python3
"""
Basset Hound - Web Scraping Workflow Example

This example demonstrates how to use Basset Hound for web scraping tasks:
- Multi-page navigation
- Content extraction
- Pagination handling
- Data collection and export
- Screenshot capture
- Error handling and retries

Requirements:
    pip install websocket-client

Usage:
    python3 web-scraping-example.py
"""

import json
import time
import csv
import logging
from typing import List, Dict, Any
from datetime import datetime
from websocket import WebSocketApp, WebSocketException
import sys
import os

# Add parent directory to path to import the client
sys.path.insert(0, os.path.dirname(__file__))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WebScraper:
    """
    Web scraping automation using Basset Hound.

    Demonstrates best practices for web scraping including:
    - Rate limiting
    - Error handling
    - Data validation
    - Export functionality
    """

    def __init__(self, ws_url: str = "ws://localhost:8765/browser"):
        """Initialize the scraper"""
        from python_client_example import BassetHoundClient
        self.client = BassetHoundClient(ws_url)
        self.scraped_data: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []

    def connect(self):
        """Connect to the browser"""
        logger.info("Connecting to Basset Hound extension...")
        self.client.connect()
        logger.info("✓ Connected successfully")

    def disconnect(self):
        """Disconnect from browser"""
        self.client.disconnect()

    def scrape_article(self, url: str) -> Dict[str, Any]:
        """
        Scrape a single article/page.

        Args:
            url: URL to scrape

        Returns:
            Scraped data dictionary
        """
        logger.info(f"Scraping: {url}")

        try:
            # Navigate to page
            self.client.navigate(url, wait_for="body", timeout=30)

            # Wait for page to settle
            time.sleep(2)

            # Get page state
            state = self.client.get_page_state()

            # Extract title
            title = state.get('title', 'N/A')

            # Extract main content
            # Try multiple selectors for content
            content_selectors = [
                'article',
                '[role="main"]',
                'main',
                '.content',
                '.article-body',
                'body'
            ]

            content_text = ""
            for selector in content_selectors:
                try:
                    content = self.client.get_content(selector)
                    if content.get('content'):
                        content_text = content['content']
                        logger.info(f"✓ Extracted content using selector: {selector}")
                        break
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue

            # Extract metadata using JavaScript
            metadata = self.client.execute_script("""
                ({
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                    author: document.querySelector('meta[name="author"]')?.content || '',
                    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
                    ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
                    ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
                    ogImage: document.querySelector('meta[property="og:image"]')?.content || ''
                })
            """)

            # Extract links
            links = state.get('links', [])
            external_links = [
                link for link in links
                if link.get('href', '').startswith('http')
            ]

            # Take screenshot
            screenshot_path = f"/tmp/scrape_{int(time.time())}.png"
            self.client.save_screenshot(screenshot_path)

            # Build result
            result = {
                'url': url,
                'title': title,
                'content_length': len(content_text),
                'content_preview': content_text[:500] if content_text else '',
                'description': metadata.get('description', ''),
                'keywords': metadata.get('keywords', ''),
                'author': metadata.get('author', ''),
                'canonical': metadata.get('canonical', ''),
                'og_title': metadata.get('ogTitle', ''),
                'og_description': metadata.get('ogDescription', ''),
                'og_image': metadata.get('ogImage', ''),
                'link_count': len(links),
                'external_link_count': len(external_links),
                'screenshot': screenshot_path,
                'scraped_at': datetime.now().isoformat(),
                'success': True
            }

            logger.info(f"✓ Scraped successfully: {title}")
            return result

        except Exception as e:
            logger.error(f"✗ Failed to scrape {url}: {e}")
            error = {
                'url': url,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            self.errors.append(error)

            return {
                'url': url,
                'error': str(e),
                'success': False,
                'scraped_at': datetime.now().isoformat()
            }

    def scrape_list(self, urls: List[str], delay: float = 2.0) -> List[Dict[str, Any]]:
        """
        Scrape multiple URLs with rate limiting.

        Args:
            urls: List of URLs to scrape
            delay: Delay between requests in seconds

        Returns:
            List of scraped data
        """
        results = []
        total = len(urls)

        logger.info(f"Starting scrape of {total} URLs...")
        logger.info(f"Rate limit: {delay}s between requests")

        for idx, url in enumerate(urls, 1):
            logger.info(f"\n[{idx}/{total}] Processing: {url}")

            # Scrape the page
            result = self.scrape_article(url)
            results.append(result)
            self.scraped_data.append(result)

            # Rate limiting (except for last URL)
            if idx < total:
                logger.info(f"Waiting {delay}s before next request...")
                time.sleep(delay)

        # Summary
        successful = sum(1 for r in results if r.get('success'))
        failed = total - successful

        logger.info("\n" + "=" * 60)
        logger.info("Scraping Summary")
        logger.info("=" * 60)
        logger.info(f"Total URLs: {total}")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info("=" * 60)

        return results

    def scrape_with_pagination(self, start_url: str, next_selector: str,
                               max_pages: int = 10) -> List[Dict[str, Any]]:
        """
        Scrape multiple pages by following pagination.

        Args:
            start_url: First page URL
            next_selector: CSS selector for "next page" link
            max_pages: Maximum pages to scrape

        Returns:
            List of all scraped data
        """
        results = []
        current_url = start_url
        page = 1

        logger.info(f"Starting pagination scrape from: {start_url}")
        logger.info(f"Max pages: {max_pages}")
        logger.info(f"Next button selector: {next_selector}")

        while current_url and page <= max_pages:
            logger.info(f"\n=== Page {page}/{max_pages} ===")

            # Scrape current page
            result = self.scrape_article(current_url)
            results.append(result)

            # Try to find next page link
            try:
                # Get next page URL
                next_url = self.client.execute_script(f"""
                    const nextLink = document.querySelector('{next_selector}');
                    nextLink ? nextLink.href : null;
                """)

                if next_url and next_url != current_url:
                    current_url = next_url
                    page += 1
                    time.sleep(2)  # Rate limiting
                else:
                    logger.info("No more pages found")
                    break

            except Exception as e:
                logger.warning(f"Failed to find next page: {e}")
                break

        logger.info(f"\n✓ Scraped {page} pages total")
        return results

    def export_to_csv(self, filename: str = "/tmp/scraped_data.csv"):
        """
        Export scraped data to CSV.

        Args:
            filename: Output CSV filename
        """
        if not self.scraped_data:
            logger.warning("No data to export")
            return

        logger.info(f"Exporting {len(self.scraped_data)} records to CSV...")

        # Get all unique keys
        all_keys = set()
        for item in self.scraped_data:
            all_keys.update(item.keys())

        # Write CSV
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=sorted(all_keys))
            writer.writeheader()
            writer.writerows(self.scraped_data)

        logger.info(f"✓ Exported to: {filename}")

    def export_to_json(self, filename: str = "/tmp/scraped_data.json"):
        """
        Export scraped data to JSON.

        Args:
            filename: Output JSON filename
        """
        if not self.scraped_data:
            logger.warning("No data to export")
            return

        logger.info(f"Exporting {len(self.scraped_data)} records to JSON...")

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({
                'scraped_at': datetime.now().isoformat(),
                'total_records': len(self.scraped_data),
                'successful': sum(1 for r in self.scraped_data if r.get('success')),
                'failed': sum(1 for r in self.scraped_data if not r.get('success')),
                'data': self.scraped_data,
                'errors': self.errors
            }, f, indent=2, ensure_ascii=False)

        logger.info(f"✓ Exported to: {filename}")


def main():
    """Example web scraping workflow"""

    # Initialize scraper
    scraper = WebScraper()

    try:
        # Connect
        scraper.connect()

        # Example 1: Scrape single page
        logger.info("\n" + "=" * 60)
        logger.info("Example 1: Single Page Scraping")
        logger.info("=" * 60)

        result = scraper.scrape_article("https://example.com")
        logger.info(f"\nResult: {json.dumps(result, indent=2)}")

        # Example 2: Scrape multiple pages
        logger.info("\n" + "=" * 60)
        logger.info("Example 2: Multiple Page Scraping")
        logger.info("=" * 60)

        urls_to_scrape = [
            "https://example.com",
            "https://www.iana.org/domains/reserved",
            # Add more URLs as needed
        ]

        results = scraper.scrape_list(urls_to_scrape, delay=2.0)

        # Example 3: Export data
        logger.info("\n" + "=" * 60)
        logger.info("Example 3: Data Export")
        logger.info("=" * 60)

        scraper.export_to_json("/tmp/scraped_data.json")
        scraper.export_to_csv("/tmp/scraped_data.csv")

        logger.info("\n✓ All scraping examples completed successfully!")

    except Exception as e:
        logger.error(f"Scraping failed: {e}", exc_info=True)

    finally:
        # Cleanup
        scraper.disconnect()


if __name__ == "__main__":
    main()
