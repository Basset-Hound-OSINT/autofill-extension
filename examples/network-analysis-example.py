#!/usr/bin/env python3
"""
Basset Hound - Network Analysis Example

This example demonstrates network monitoring and analysis capabilities:
- Network request tracking
- HAR file export
- Performance analysis
- Resource size analysis
- Third-party request detection
- API endpoint discovery

Requirements:
    pip install websocket-client

Usage:
    python3 network-analysis-example.py https://example.com
"""

import json
import time
import logging
import sys
import os
from typing import Dict, Any, List
from datetime import datetime
from collections import defaultdict
from urllib.parse import urlparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class NetworkAnalyzer:
    """
    Network analysis automation using Basset Hound.

    Demonstrates network monitoring including:
    - Request/response tracking
    - Performance metrics
    - Resource analysis
    - HAR export
    """

    def __init__(self, ws_url: str = "ws://localhost:8765/browser"):
        """Initialize the analyzer"""
        from python_client_example import BassetHoundClient
        self.client = BassetHoundClient(ws_url)
        self.network_data: Dict[str, Any] = {}

    def connect(self):
        """Connect to browser"""
        logger.info("Connecting to Basset Hound extension...")
        self.client.connect()
        logger.info("✓ Connected successfully")

    def disconnect(self):
        """Disconnect from browser"""
        self.client.disconnect()

    def start_monitoring(self):
        """Start network monitoring"""
        logger.info("Starting network monitoring...")
        result = self.client._send_command("start_network_monitoring", {})
        logger.info("✓ Network monitoring started")
        return result

    def stop_monitoring(self) -> Dict[str, Any]:
        """Stop network monitoring and get results"""
        logger.info("Stopping network monitoring...")
        result = self.client._send_command("stop_network_monitoring", {})
        logger.info(f"✓ Network monitoring stopped. Captured {len(result.get('requests', []))} requests")
        return result

    def get_network_logs(self) -> Dict[str, Any]:
        """Get current network logs"""
        logger.info("Retrieving network logs...")
        result = self.client._send_command("get_network_logs", {})
        logger.info(f"✓ Retrieved {len(result.get('requests', []))} network requests")
        return result

    def export_har(self, filename: str = "/tmp/network.har") -> str:
        """
        Export network data as HAR file.

        Args:
            filename: Output HAR filename

        Returns:
            Path to exported file
        """
        logger.info("Exporting network data as HAR...")
        result = self.client._send_command("export_network_har", {})

        har_data = result.get('har', {})

        # Save to file
        with open(filename, 'w') as f:
            json.dump(har_data, f, indent=2)

        logger.info(f"✓ HAR exported to: {filename}")
        return filename

    def analyze_requests(self, network_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze network requests.

        Args:
            network_data: Network data from monitoring

        Returns:
            Analysis results
        """
        logger.info("Analyzing network requests...")

        requests = network_data.get('requests', [])

        if not requests:
            logger.warning("No requests to analyze")
            return {}

        # Initialize counters
        by_type = defaultdict(int)
        by_status = defaultdict(int)
        by_domain = defaultdict(int)
        total_size = 0
        failed_requests = []
        slow_requests = []
        third_party_requests = []

        # Get base domain
        if requests:
            first_url = requests[0].get('url', '')
            base_domain = urlparse(first_url).netloc

        # Analyze each request
        for req in requests:
            url = req.get('url', '')
            resource_type = req.get('type', 'other')
            status = req.get('statusCode', 0)
            size = req.get('size', 0)
            duration = req.get('duration', 0)

            # Count by type
            by_type[resource_type] += 1

            # Count by status
            by_status[status] += 1

            # Count by domain
            domain = urlparse(url).netloc
            by_domain[domain] += 1

            # Total size
            total_size += size

            # Failed requests (4xx, 5xx)
            if status >= 400:
                failed_requests.append({
                    'url': url,
                    'status': status,
                    'type': resource_type
                })

            # Slow requests (> 1s)
            if duration > 1000:
                slow_requests.append({
                    'url': url,
                    'duration': duration,
                    'type': resource_type
                })

            # Third-party requests
            if domain != base_domain and domain:
                third_party_requests.append({
                    'url': url,
                    'domain': domain,
                    'type': resource_type,
                    'size': size
                })

        # Calculate statistics
        analysis = {
            'summary': {
                'total_requests': len(requests),
                'total_size_mb': total_size / (1024 * 1024),
                'unique_domains': len(by_domain),
                'failed_requests': len(failed_requests),
                'slow_requests': len(slow_requests),
                'third_party_requests': len(third_party_requests)
            },
            'by_type': dict(by_type),
            'by_status': dict(by_status),
            'by_domain': dict(sorted(by_domain.items(), key=lambda x: x[1], reverse=True)[:10]),
            'failed_requests': failed_requests[:10],  # Top 10
            'slow_requests': sorted(slow_requests, key=lambda x: x['duration'], reverse=True)[:10],
            'third_party_requests': sorted(
                third_party_requests,
                key=lambda x: x['size'],
                reverse=True
            )[:10]
        }

        logger.info(f"✓ Analysis complete")
        return analysis

    def detect_api_endpoints(self, network_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Detect API endpoints from network requests.

        Args:
            network_data: Network data from monitoring

        Returns:
            List of detected API endpoints
        """
        logger.info("Detecting API endpoints...")

        requests = network_data.get('requests', [])
        api_endpoints = []

        # Common API indicators
        api_indicators = ['/api/', '/v1/', '/v2/', '/v3/', '/graphql', '/rest/']

        for req in requests:
            url = req.get('url', '')
            method = req.get('method', 'GET')
            status = req.get('statusCode', 0)
            response_type = req.get('responseType', '')

            # Check if URL looks like an API endpoint
            is_api = any(indicator in url.lower() for indicator in api_indicators)
            is_json = 'json' in response_type.lower() if response_type else False

            if is_api or is_json:
                api_endpoints.append({
                    'url': url,
                    'method': method,
                    'status': status,
                    'response_type': response_type
                })

        logger.info(f"✓ Found {len(api_endpoints)} API endpoints")
        return api_endpoints

    def analyze_performance(self, network_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze performance metrics.

        Args:
            network_data: Network data from monitoring

        Returns:
            Performance analysis
        """
        logger.info("Analyzing performance...")

        requests = network_data.get('requests', [])

        if not requests:
            return {}

        durations = [req.get('duration', 0) for req in requests]
        sizes = [req.get('size', 0) for req in requests]

        # Calculate metrics
        performance = {
            'request_timing': {
                'fastest': min(durations) if durations else 0,
                'slowest': max(durations) if durations else 0,
                'average': sum(durations) / len(durations) if durations else 0,
                'total': sum(durations)
            },
            'size_metrics': {
                'smallest': min(sizes) if sizes else 0,
                'largest': max(sizes) if sizes else 0,
                'average': sum(sizes) / len(sizes) if sizes else 0,
                'total_mb': sum(sizes) / (1024 * 1024)
            },
            'recommendations': []
        }

        # Add recommendations
        if performance['request_timing']['slowest'] > 3000:
            performance['recommendations'].append(
                f"Slowest request took {performance['request_timing']['slowest']}ms. Optimize slow endpoints."
            )

        if performance['size_metrics']['total_mb'] > 5:
            performance['recommendations'].append(
                f"Total page size is {performance['size_metrics']['total_mb']:.2f}MB. Consider optimization."
            )

        return performance

    def run_analysis(self, url: str, duration: int = 10) -> Dict[str, Any]:
        """
        Run complete network analysis.

        Args:
            url: URL to analyze
            duration: Monitoring duration in seconds

        Returns:
            Complete analysis results
        """
        logger.info("\n" + "=" * 60)
        logger.info(f"Starting Network Analysis: {url}")
        logger.info("=" * 60 + "\n")

        # Start monitoring
        self.start_monitoring()

        # Navigate to URL
        logger.info(f"Navigating to {url}...")
        self.client.navigate(url, timeout=30)

        # Monitor for specified duration
        logger.info(f"Monitoring network activity for {duration} seconds...")
        time.sleep(duration)

        # Stop monitoring and get data
        network_data = self.stop_monitoring()

        # Run analyses
        results = {
            'url': url,
            'analyzed_at': datetime.now().isoformat(),
            'monitoring_duration': duration,
            'network_data': network_data,
            'request_analysis': self.analyze_requests(network_data),
            'api_endpoints': self.detect_api_endpoints(network_data),
            'performance': self.analyze_performance(network_data)
        }

        # Export HAR
        har_file = f"/tmp/network_{int(time.time())}.har"
        try:
            results['har_file'] = self.export_har(har_file)
        except Exception as e:
            logger.warning(f"Failed to export HAR: {e}")
            results['har_file'] = None

        return results

    def print_report(self, results: Dict[str, Any]):
        """
        Print formatted analysis report.

        Args:
            results: Analysis results dictionary
        """
        print("\n" + "=" * 60)
        print("NETWORK ANALYSIS REPORT")
        print("=" * 60)
        print(f"URL: {results['url']}")
        print(f"Analyzed: {results['analyzed_at']}")
        print(f"Duration: {results['monitoring_duration']}s")
        print("=" * 60)

        # Summary
        summary = results['request_analysis']['summary']
        print("\n1. SUMMARY")
        print("-" * 60)
        print(f"  Total Requests: {summary['total_requests']}")
        print(f"  Total Size: {summary['total_size_mb']:.2f} MB")
        print(f"  Unique Domains: {summary['unique_domains']}")
        print(f"  Failed Requests: {summary['failed_requests']}")
        print(f"  Slow Requests (>1s): {summary['slow_requests']}")
        print(f"  Third-Party Requests: {summary['third_party_requests']}")

        # By Type
        print("\n2. REQUESTS BY TYPE")
        print("-" * 60)
        for req_type, count in results['request_analysis']['by_type'].items():
            print(f"  {req_type}: {count}")

        # By Status
        print("\n3. REQUESTS BY STATUS CODE")
        print("-" * 60)
        for status, count in sorted(results['request_analysis']['by_status'].items()):
            print(f"  {status}: {count}")

        # Top Domains
        print("\n4. TOP DOMAINS")
        print("-" * 60)
        for domain, count in list(results['request_analysis']['by_domain'].items())[:10]:
            print(f"  {domain}: {count} requests")

        # Failed Requests
        if results['request_analysis']['failed_requests']:
            print("\n5. FAILED REQUESTS")
            print("-" * 60)
            for req in results['request_analysis']['failed_requests'][:5]:
                print(f"  [{req['status']}] {req['url'][:80]}")

        # Slow Requests
        if results['request_analysis']['slow_requests']:
            print("\n6. SLOW REQUESTS")
            print("-" * 60)
            for req in results['request_analysis']['slow_requests'][:5]:
                print(f"  [{req['duration']}ms] {req['url'][:80]}")

        # API Endpoints
        if results['api_endpoints']:
            print("\n7. API ENDPOINTS DETECTED")
            print("-" * 60)
            for endpoint in results['api_endpoints'][:10]:
                print(f"  [{endpoint['method']}] {endpoint['url'][:80]}")

        # Performance
        print("\n8. PERFORMANCE METRICS")
        print("-" * 60)
        perf = results['performance']
        timing = perf['request_timing']
        print(f"  Request Timing:")
        print(f"    Fastest: {timing['fastest']}ms")
        print(f"    Slowest: {timing['slowest']}ms")
        print(f"    Average: {timing['average']:.2f}ms")

        if perf.get('recommendations'):
            print("\n  Recommendations:")
            for rec in perf['recommendations']:
                print(f"    - {rec}")

        # HAR Export
        print("\n9. EXPORT")
        print("-" * 60)
        if results.get('har_file'):
            print(f"  HAR file: {results['har_file']}")
        else:
            print("  HAR export not available")

        print("\n" + "=" * 60 + "\n")


def main():
    """Run network analysis"""
    if len(sys.argv) < 2:
        print("Usage: python3 network-analysis-example.py <url> [duration]")
        print("Example: python3 network-analysis-example.py https://example.com 15")
        sys.exit(1)

    url = sys.argv[1]
    duration = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    # Initialize analyzer
    analyzer = NetworkAnalyzer()

    try:
        # Connect
        analyzer.connect()

        # Run analysis
        results = analyzer.run_analysis(url, duration)

        # Print report
        analyzer.print_report(results)

        # Save JSON report
        report_file = f"/tmp/network_analysis_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            # Remove network_data from saved report (can be large)
            save_results = results.copy()
            save_results.pop('network_data', None)
            json.dump(save_results, f, indent=2)
        logger.info(f"Full report saved to: {report_file}")

    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)

    finally:
        analyzer.disconnect()


if __name__ == "__main__":
    main()
