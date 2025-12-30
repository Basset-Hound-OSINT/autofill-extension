#!/usr/bin/env python3
"""
Basset Hound - SEO Audit Example

This example demonstrates using Basset Hound for SEO auditing:
- Meta tag analysis
- Header structure validation
- Image alt text checking
- Link analysis (internal/external)
- Performance metrics
- Mobile responsiveness checks
- Structured data detection

Requirements:
    pip install websocket-client

Usage:
    python3 seo-audit-example.py https://example.com
"""

import json
import time
import logging
import sys
import os
from typing import Dict, Any, List
from datetime import datetime
from urllib.parse import urlparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SEOAuditor:
    """
    SEO audit automation using Basset Hound.

    Performs comprehensive SEO analysis including:
    - Meta tags
    - Headers
    - Images
    - Links
    - Performance
    - Accessibility
    """

    def __init__(self, ws_url: str = "ws://localhost:8765/browser"):
        """Initialize the auditor"""
        from python_client_example import BassetHoundClient
        self.client = BassetHoundClient(ws_url)
        self.audit_results: Dict[str, Any] = {}

    def connect(self):
        """Connect to browser"""
        logger.info("Connecting to Basset Hound extension...")
        self.client.connect()
        logger.info("✓ Connected successfully")

    def disconnect(self):
        """Disconnect from browser"""
        self.client.disconnect()

    def audit_meta_tags(self, url: str) -> Dict[str, Any]:
        """
        Audit meta tags for SEO.

        Args:
            url: URL to audit

        Returns:
            Meta tag audit results
        """
        logger.info("Auditing meta tags...")

        # Extract all meta tags
        meta_data = self.client.execute_script("""
            const metaTags = {};

            // Title
            metaTags.title = document.title || '';
            metaTags.titleLength = metaTags.title.length;

            // Description
            const descMeta = document.querySelector('meta[name="description"]');
            metaTags.description = descMeta?.content || '';
            metaTags.descriptionLength = metaTags.description.length;

            // Keywords
            const keywordsMeta = document.querySelector('meta[name="keywords"]');
            metaTags.keywords = keywordsMeta?.content || '';

            // Canonical
            const canonical = document.querySelector('link[rel="canonical"]');
            metaTags.canonical = canonical?.href || '';

            // Robots
            const robotsMeta = document.querySelector('meta[name="robots"]');
            metaTags.robots = robotsMeta?.content || '';

            // Open Graph
            metaTags.og = {
                title: document.querySelector('meta[property="og:title"]')?.content || '',
                description: document.querySelector('meta[property="og:description"]')?.content || '',
                image: document.querySelector('meta[property="og:image"]')?.content || '',
                url: document.querySelector('meta[property="og:url"]')?.content || '',
                type: document.querySelector('meta[property="og:type"]')?.content || ''
            };

            // Twitter Card
            metaTags.twitter = {
                card: document.querySelector('meta[name="twitter:card"]')?.content || '',
                title: document.querySelector('meta[name="twitter:title"]')?.content || '',
                description: document.querySelector('meta[name="twitter:description"]')?.content || '',
                image: document.querySelector('meta[name="twitter:image"]')?.content || ''
            };

            // Viewport
            const viewport = document.querySelector('meta[name="viewport"]');
            metaTags.viewport = viewport?.content || '';

            // Charset
            const charset = document.querySelector('meta[charset]');
            metaTags.charset = charset?.getAttribute('charset') || '';

            metaTags
        """)

        # Analyze results
        issues = []
        recommendations = []

        # Title checks
        if not meta_data.get('title'):
            issues.append("Missing page title")
        elif meta_data['titleLength'] < 30:
            recommendations.append(f"Title is too short ({meta_data['titleLength']} chars). Recommended: 50-60 chars")
        elif meta_data['titleLength'] > 60:
            recommendations.append(f"Title is too long ({meta_data['titleLength']} chars). Recommended: 50-60 chars")

        # Description checks
        if not meta_data.get('description'):
            issues.append("Missing meta description")
        elif meta_data['descriptionLength'] < 120:
            recommendations.append(f"Description is too short ({meta_data['descriptionLength']} chars). Recommended: 150-160 chars")
        elif meta_data['descriptionLength'] > 160:
            recommendations.append(f"Description is too long ({meta_data['descriptionLength']} chars). Recommended: 150-160 chars")

        # Canonical check
        if not meta_data.get('canonical'):
            recommendations.append("Consider adding canonical URL")

        # Open Graph checks
        if not meta_data['og']['title']:
            recommendations.append("Missing Open Graph title")
        if not meta_data['og']['description']:
            recommendations.append("Missing Open Graph description")
        if not meta_data['og']['image']:
            recommendations.append("Missing Open Graph image")

        # Viewport check
        if not meta_data.get('viewport'):
            issues.append("Missing viewport meta tag (mobile responsiveness)")

        return {
            'meta_tags': meta_data,
            'issues': issues,
            'recommendations': recommendations,
            'score': max(0, 100 - (len(issues) * 15) - (len(recommendations) * 5))
        }

    def audit_headers(self) -> Dict[str, Any]:
        """
        Audit header structure (H1-H6).

        Returns:
            Header audit results
        """
        logger.info("Auditing header structure...")

        headers_data = self.client.execute_script("""
            const headers = {
                h1: [],
                h2: [],
                h3: [],
                h4: [],
                h5: [],
                h6: []
            };

            for (let i = 1; i <= 6; i++) {
                const elements = document.querySelectorAll(`h${i}`);
                elements.forEach(el => {
                    headers[`h${i}`].push({
                        text: el.textContent.trim(),
                        length: el.textContent.trim().length
                    });
                });
            }

            ({
                ...headers,
                h1Count: headers.h1.length,
                h2Count: headers.h2.length,
                h3Count: headers.h3.length,
                h4Count: headers.h4.length,
                h5Count: headers.h5.length,
                h6Count: headers.h6.length
            })
        """)

        issues = []
        recommendations = []

        # H1 checks
        if headers_data['h1Count'] == 0:
            issues.append("No H1 heading found")
        elif headers_data['h1Count'] > 1:
            issues.append(f"Multiple H1 headings found ({headers_data['h1Count']}). Should have exactly one H1")

        # Header hierarchy
        if headers_data['h1Count'] == 0 and headers_data['h2Count'] > 0:
            recommendations.append("H2 used without H1 (breaks header hierarchy)")

        return {
            'headers': headers_data,
            'issues': issues,
            'recommendations': recommendations,
            'score': max(0, 100 - (len(issues) * 20) - (len(recommendations) * 5))
        }

    def audit_images(self) -> Dict[str, Any]:
        """
        Audit images for alt text and optimization.

        Returns:
            Image audit results
        """
        logger.info("Auditing images...")

        images_data = self.client.execute_script("""
            const images = Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt || '',
                hasAlt: !!img.alt,
                width: img.width,
                height: img.height,
                loading: img.loading || 'auto'
            }));

            ({
                images: images,
                totalImages: images.length,
                imagesWithAlt: images.filter(i => i.hasAlt).length,
                imagesWithoutAlt: images.filter(i => !i.hasAlt).length,
                lazyLoadedImages: images.filter(i => i.loading === 'lazy').length
            })
        """)

        issues = []
        recommendations = []

        # Alt text checks
        if images_data['imagesWithoutAlt'] > 0:
            issues.append(f"{images_data['imagesWithoutAlt']} images missing alt text")

        # Lazy loading recommendation
        if images_data['totalImages'] > 3 and images_data['lazyLoadedImages'] == 0:
            recommendations.append("Consider implementing lazy loading for images")

        # List images without alt text
        missing_alt = [
            img['src'] for img in images_data['images'] if not img['hasAlt']
        ][:10]  # Limit to first 10

        return {
            'summary': {
                'total': images_data['totalImages'],
                'with_alt': images_data['imagesWithAlt'],
                'without_alt': images_data['imagesWithoutAlt'],
                'lazy_loaded': images_data['lazyLoadedImages']
            },
            'missing_alt_samples': missing_alt,
            'issues': issues,
            'recommendations': recommendations,
            'score': max(0, 100 - (images_data['imagesWithoutAlt'] * 5))
        }

    def audit_links(self, base_url: str) -> Dict[str, Any]:
        """
        Audit internal and external links.

        Args:
            base_url: Base URL for internal link detection

        Returns:
            Link audit results
        """
        logger.info("Auditing links...")

        base_domain = urlparse(base_url).netloc

        links_data = self.client.execute_script(f"""
            const baseDomain = '{base_domain}';
            const links = Array.from(document.querySelectorAll('a')).map(a => ({{
                href: a.href,
                text: a.textContent.trim(),
                hasText: !!a.textContent.trim(),
                isExternal: a.hostname !== baseDomain,
                hasNofollow: a.rel.includes('nofollow'),
                opensNewTab: a.target === '_blank',
                hasNoopener: a.rel.includes('noopener')
            }}));

            const externalLinks = links.filter(l => l.isExternal);
            const internalLinks = links.filter(l => !l.isExternal);

            ({{
                totalLinks: links.length,
                internalLinks: internalLinks.length,
                externalLinks: externalLinks.length,
                linksWithoutText: links.filter(l => !l.hasText).length,
                externalWithoutNoopener: externalLinks.filter(
                    l => l.opensNewTab && !l.hasNoopener
                ).length,
                brokenLinkCandidates: links.filter(
                    l => !l.href || l.href === '#' || l.href.startsWith('javascript:')
                ).length
            }})
        """)

        issues = []
        recommendations = []

        # Security check for external links
        if links_data['externalWithoutNoopener'] > 0:
            issues.append(
                f"{links_data['externalWithoutNoopener']} external links opening in new tab "
                "without rel=\"noopener\" (security issue)"
            )

        # Accessibility check
        if links_data['linksWithoutText'] > 0:
            issues.append(f"{links_data['linksWithoutText']} links without text (accessibility issue)")

        # Broken links
        if links_data['brokenLinkCandidates'] > 0:
            recommendations.append(f"{links_data['brokenLinkCandidates']} potential broken/empty links")

        return {
            'summary': links_data,
            'issues': issues,
            'recommendations': recommendations,
            'score': max(0, 100 - (len(issues) * 15) - (len(recommendations) * 5))
        }

    def audit_performance(self) -> Dict[str, Any]:
        """
        Audit performance metrics.

        Returns:
            Performance audit results
        """
        logger.info("Auditing performance...")

        perf_data = self.client.execute_script("""
            const perf = performance.getEntriesByType('navigation')[0] || {};
            const resources = performance.getEntriesByType('resource');

            ({
                loadTime: perf.loadEventEnd - perf.fetchStart,
                domContentLoaded: perf.domContentLoadedEventEnd - perf.fetchStart,
                resourceCount: resources.length,
                totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
                scriptCount: resources.filter(r => r.initiatorType === 'script').length,
                cssCount: resources.filter(r => r.initiatorType === 'css' || r.initiatorType === 'link').length,
                imageCount: resources.filter(r => r.initiatorType === 'img').length,
                fontCount: resources.filter(r => r.name.includes('.woff') || r.name.includes('.ttf')).length
            })
        """)

        recommendations = []

        # Page load time
        load_time_sec = perf_data.get('loadTime', 0) / 1000
        if load_time_sec > 3:
            recommendations.append(f"Page load time is slow ({load_time_sec:.2f}s). Target: < 3s")

        # Resource count
        if perf_data.get('scriptCount', 0) > 10:
            recommendations.append(f"High number of scripts ({perf_data['scriptCount']}). Consider bundling")

        # Total size
        total_mb = perf_data.get('totalSize', 0) / (1024 * 1024)
        if total_mb > 2:
            recommendations.append(f"Large page size ({total_mb:.2f}MB). Consider optimization")

        return {
            'metrics': perf_data,
            'recommendations': recommendations,
            'score': max(0, 100 - (len(recommendations) * 10))
        }

    def audit_structured_data(self) -> Dict[str, Any]:
        """
        Detect structured data (JSON-LD, microdata).

        Returns:
            Structured data audit results
        """
        logger.info("Auditing structured data...")

        structured_data = self.client.execute_script("""
            const jsonLd = Array.from(
                document.querySelectorAll('script[type="application/ld+json"]')
            ).map(script => {
                try {
                    return JSON.parse(script.textContent);
                } catch(e) {
                    return null;
                }
            }).filter(Boolean);

            ({
                hasJsonLd: jsonLd.length > 0,
                jsonLdCount: jsonLd.length,
                jsonLdTypes: jsonLd.map(d => d['@type'] || 'Unknown')
            })
        """)

        recommendations = []

        if not structured_data.get('hasJsonLd'):
            recommendations.append("No structured data found. Consider adding JSON-LD for better search visibility")

        return {
            'structured_data': structured_data,
            'recommendations': recommendations,
            'score': 100 if structured_data.get('hasJsonLd') else 50
        }

    def run_full_audit(self, url: str) -> Dict[str, Any]:
        """
        Run complete SEO audit.

        Args:
            url: URL to audit

        Returns:
            Complete audit results
        """
        logger.info("\n" + "=" * 60)
        logger.info(f"Starting SEO Audit: {url}")
        logger.info("=" * 60 + "\n")

        # Navigate to URL
        self.client.navigate(url, timeout=30)
        time.sleep(3)  # Let page fully load

        # Run all audits
        results = {
            'url': url,
            'audited_at': datetime.now().isoformat(),
            'meta_tags': self.audit_meta_tags(url),
            'headers': self.audit_headers(),
            'images': self.audit_images(),
            'links': self.audit_links(url),
            'performance': self.audit_performance(),
            'structured_data': self.audit_structured_data()
        }

        # Calculate overall score
        scores = [
            results['meta_tags']['score'],
            results['headers']['score'],
            results['images']['score'],
            results['links']['score'],
            results['performance']['score'],
            results['structured_data']['score']
        ]
        results['overall_score'] = sum(scores) / len(scores)

        # Take screenshot
        screenshot_path = f"/tmp/seo_audit_{int(time.time())}.png"
        self.client.save_screenshot(screenshot_path)
        results['screenshot'] = screenshot_path

        return results

    def print_report(self, results: Dict[str, Any]):
        """
        Print formatted audit report.

        Args:
            results: Audit results dictionary
        """
        print("\n" + "=" * 60)
        print("SEO AUDIT REPORT")
        print("=" * 60)
        print(f"URL: {results['url']}")
        print(f"Audited: {results['audited_at']}")
        print(f"Overall Score: {results['overall_score']:.1f}/100")
        print("=" * 60)

        # Meta Tags
        print("\n1. META TAGS (Score: {:.1f}/100)".format(results['meta_tags']['score']))
        print("-" * 60)
        meta = results['meta_tags']['meta_tags']
        print(f"  Title: {meta.get('title', 'N/A')} ({meta.get('titleLength', 0)} chars)")
        print(f"  Description: {meta.get('description', 'N/A')[:80]}... ({meta.get('descriptionLength', 0)} chars)")
        if results['meta_tags']['issues']:
            print("  Issues:")
            for issue in results['meta_tags']['issues']:
                print(f"    - {issue}")
        if results['meta_tags']['recommendations']:
            print("  Recommendations:")
            for rec in results['meta_tags']['recommendations']:
                print(f"    - {rec}")

        # Headers
        print("\n2. HEADERS (Score: {:.1f}/100)".format(results['headers']['score']))
        print("-" * 60)
        headers = results['headers']['headers']
        print(f"  H1: {headers['h1Count']}")
        print(f"  H2: {headers['h2Count']}")
        print(f"  H3: {headers['h3Count']}")
        if results['headers']['issues']:
            print("  Issues:")
            for issue in results['headers']['issues']:
                print(f"    - {issue}")

        # Images
        print("\n3. IMAGES (Score: {:.1f}/100)".format(results['images']['score']))
        print("-" * 60)
        imgs = results['images']['summary']
        print(f"  Total Images: {imgs['total']}")
        print(f"  With Alt Text: {imgs['with_alt']}")
        print(f"  Without Alt Text: {imgs['without_alt']}")
        if results['images']['issues']:
            print("  Issues:")
            for issue in results['images']['issues']:
                print(f"    - {issue}")

        # Links
        print("\n4. LINKS (Score: {:.1f}/100)".format(results['links']['score']))
        print("-" * 60)
        links = results['links']['summary']
        print(f"  Total Links: {links['totalLinks']}")
        print(f"  Internal: {links['internalLinks']}")
        print(f"  External: {links['externalLinks']}")
        if results['links']['issues']:
            print("  Issues:")
            for issue in results['links']['issues']:
                print(f"    - {issue}")

        # Performance
        print("\n5. PERFORMANCE (Score: {:.1f}/100)".format(results['performance']['score']))
        print("-" * 60)
        perf = results['performance']['metrics']
        print(f"  Load Time: {perf.get('loadTime', 0) / 1000:.2f}s")
        print(f"  Resources: {perf.get('resourceCount', 0)}")
        print(f"  Page Size: {perf.get('totalSize', 0) / 1024:.1f}KB")
        if results['performance']['recommendations']:
            print("  Recommendations:")
            for rec in results['performance']['recommendations']:
                print(f"    - {rec}")

        # Structured Data
        print("\n6. STRUCTURED DATA (Score: {:.1f}/100)".format(results['structured_data']['score']))
        print("-" * 60)
        sd = results['structured_data']['structured_data']
        print(f"  JSON-LD Found: {sd.get('hasJsonLd', False)}")
        if sd.get('jsonLdTypes'):
            print(f"  Types: {', '.join(sd['jsonLdTypes'])}")

        print("\n" + "=" * 60)
        print(f"Screenshot saved: {results['screenshot']}")
        print("=" * 60 + "\n")


def main():
    """Run SEO audit"""
    if len(sys.argv) < 2:
        print("Usage: python3 seo-audit-example.py <url>")
        print("Example: python3 seo-audit-example.py https://example.com")
        sys.exit(1)

    url = sys.argv[1]

    # Initialize auditor
    auditor = SEOAuditor()

    try:
        # Connect
        auditor.connect()

        # Run audit
        results = auditor.run_full_audit(url)

        # Print report
        auditor.print_report(results)

        # Save JSON report
        report_file = f"/tmp/seo_audit_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            json.dump(results, f, indent=2)
        logger.info(f"Full report saved to: {report_file}")

    except Exception as e:
        logger.error(f"Audit failed: {e}", exc_info=True)

    finally:
        auditor.disconnect()


if __name__ == "__main__":
    main()
