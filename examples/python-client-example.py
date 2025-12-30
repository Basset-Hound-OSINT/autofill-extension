#!/usr/bin/env python3
"""
Basset Hound Python Client - Complete Example

This example demonstrates all features of the Basset Hound browser automation extension
including navigation, form filling, content extraction, screenshots, and more.

Requirements:
    pip install websocket-client

Usage:
    python3 python-client-example.py
"""

import json
import time
import base64
import logging
from typing import Dict, Any, Optional, List
from websocket import WebSocketApp, WebSocketException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BassetHoundClient:
    """
    Python client for Basset Hound browser automation extension.

    Provides a high-level interface for browser automation through WebSocket.
    """

    def __init__(self, url: str = "ws://localhost:8765/browser"):
        """
        Initialize the client.

        Args:
            url: WebSocket server URL (default: ws://localhost:8765/browser)
        """
        self.url = url
        self.ws: Optional[WebSocketApp] = None
        self.connected = False
        self.responses: Dict[str, Any] = {}
        self.command_counter = 0

    def connect(self, timeout: int = 10) -> bool:
        """
        Connect to the WebSocket server.

        Args:
            timeout: Connection timeout in seconds

        Returns:
            True if connected successfully

        Raises:
            WebSocketException: If connection fails
        """
        logger.info(f"Connecting to {self.url}...")

        def on_message(ws, message):
            """Handle incoming messages"""
            try:
                data = json.loads(message)
                logger.debug(f"Received: {json.dumps(data, indent=2)}")

                # Store responses by command_id
                if 'command_id' in data:
                    self.responses[data['command_id']] = data
                elif data.get('type') == 'connected':
                    logger.info("✓ Connected to Basset Hound extension")
                    self.connected = True

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse message: {e}")

        def on_error(ws, error):
            """Handle errors"""
            logger.error(f"WebSocket error: {error}")

        def on_close(ws, close_status_code, close_msg):
            """Handle connection close"""
            logger.info(f"Connection closed: {close_status_code} - {close_msg}")
            self.connected = False

        def on_open(ws):
            """Handle connection open"""
            logger.info("WebSocket connection established")

        # Create WebSocket app
        self.ws = WebSocketApp(
            self.url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )

        # Run in background thread
        import threading
        ws_thread = threading.Thread(target=self.ws.run_forever, daemon=True)
        ws_thread.start()

        # Wait for connection
        start_time = time.time()
        while not self.connected and (time.time() - start_time) < timeout:
            time.sleep(0.1)

        if not self.connected:
            raise WebSocketException("Connection timeout")

        return True

    def disconnect(self):
        """Disconnect from the WebSocket server"""
        if self.ws:
            self.ws.close()
            self.connected = False
            logger.info("Disconnected")

    def _send_command(self, command_type: str, params: Dict[str, Any],
                     timeout: int = 30) -> Dict[str, Any]:
        """
        Send a command and wait for response.

        Args:
            command_type: Type of command (e.g., 'navigate', 'fill_form')
            params: Command parameters
            timeout: Response timeout in seconds

        Returns:
            Response dictionary

        Raises:
            Exception: If command fails or times out
        """
        if not self.connected:
            raise Exception("Not connected to server")

        # Generate unique command ID
        self.command_counter += 1
        command_id = f"cmd-{self.command_counter}"

        # Build command
        command = {
            "command_id": command_id,
            "type": command_type,
            "params": params
        }

        logger.info(f"Sending command: {command_type} (ID: {command_id})")
        logger.debug(f"Command details: {json.dumps(command, indent=2)}")

        # Send command
        self.ws.send(json.dumps(command))

        # Wait for response
        start_time = time.time()
        while command_id not in self.responses:
            if (time.time() - start_time) > timeout:
                raise Exception(f"Command timeout after {timeout}s")
            time.sleep(0.1)

        # Get and remove response
        response = self.responses.pop(command_id)

        # Check for errors
        if not response.get('success'):
            error = response.get('error', 'Unknown error')
            logger.error(f"Command failed: {error}")
            raise Exception(f"Command failed: {error}")

        logger.info(f"✓ Command completed: {command_type}")
        return response.get('result', {})

    def navigate(self, url: str, wait_for: Optional[str] = None,
                timeout: int = 30) -> Dict[str, Any]:
        """
        Navigate to a URL.

        Args:
            url: URL to navigate to
            wait_for: CSS selector to wait for after navigation
            timeout: Navigation timeout in seconds

        Returns:
            Navigation result with URL, loaded status, and tab ID
        """
        params = {"url": url}
        if wait_for:
            params["wait_for"] = wait_for
        params["timeout"] = timeout * 1000  # Convert to milliseconds

        return self._send_command("navigate", params, timeout)

    def fill_form(self, fields: Dict[str, Any], submit: bool = False) -> Dict[str, Any]:
        """
        Fill form fields.

        Args:
            fields: Dictionary mapping selectors to values
            submit: Whether to submit the form after filling

        Returns:
            Fill results with success status for each field
        """
        params = {
            "fields": fields,
            "submit": submit
        }
        return self._send_command("fill_form", params)

    def click(self, selector: str, wait_after: int = 0) -> Dict[str, Any]:
        """
        Click an element.

        Args:
            selector: CSS selector for element to click
            wait_after: Milliseconds to wait after clicking

        Returns:
            Click result
        """
        params = {
            "selector": selector,
            "wait_after": wait_after
        }
        return self._send_command("click", params)

    def get_content(self, selector: str = "body") -> Dict[str, Any]:
        """
        Extract content from page.

        Args:
            selector: CSS selector for content extraction

        Returns:
            Dictionary with 'content' (text) and 'html' keys
        """
        params = {"selector": selector}
        return self._send_command("get_content", params)

    def screenshot(self, format: str = "png", quality: int = 100) -> str:
        """
        Take a screenshot.

        Args:
            format: Image format ('png' or 'jpeg')
            quality: Image quality (1-100, JPEG only)

        Returns:
            Base64-encoded data URL
        """
        params = {
            "format": format,
            "quality": quality
        }
        result = self._send_command("screenshot", params)
        return result.get('screenshot', '')

    def wait_for_element(self, selector: str, timeout: int = 10) -> Dict[str, Any]:
        """
        Wait for an element to appear.

        Args:
            selector: CSS selector to wait for
            timeout: Timeout in seconds

        Returns:
            Element info if found
        """
        params = {
            "selector": selector,
            "timeout": timeout * 1000  # Convert to milliseconds
        }
        return self._send_command("wait_for_element", params, timeout)

    def get_page_state(self) -> Dict[str, Any]:
        """
        Get comprehensive page state.

        Returns:
            Dictionary with forms, links, buttons, inputs, and metadata
        """
        return self._send_command("get_page_state", {})

    def execute_script(self, script: str) -> Any:
        """
        Execute JavaScript in page context.

        Args:
            script: JavaScript code to execute

        Returns:
            Script result
        """
        params = {"script": script}
        result = self._send_command("execute_script", params)
        return result.get('result')

    def get_cookies(self, url: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get cookies for a URL or current domain.

        Args:
            url: URL to get cookies for (optional)

        Returns:
            List of cookie objects
        """
        params = {}
        if url:
            params["url"] = url
        result = self._send_command("get_cookies", params)
        return result.get('cookies', [])

    def detect_forms(self) -> List[Dict[str, Any]]:
        """
        Detect forms on current page.

        Returns:
            List of form objects with fields
        """
        result = self._send_command("detect_forms", {})
        return result.get('forms', [])

    def detect_captcha(self) -> Dict[str, Any]:
        """
        Detect CAPTCHAs on current page.

        Returns:
            CAPTCHA detection results
        """
        return self._send_command("detect_captcha", {})

    def save_screenshot(self, filename: str, format: str = "png") -> str:
        """
        Take screenshot and save to file.

        Args:
            filename: Output filename
            format: Image format ('png' or 'jpeg')

        Returns:
            Filename of saved screenshot
        """
        data_url = self.screenshot(format=format)

        # Extract base64 data
        if ',' in data_url:
            base64_data = data_url.split(',', 1)[1]
        else:
            base64_data = data_url

        # Decode and save
        image_data = base64.b64decode(base64_data)
        with open(filename, 'wb') as f:
            f.write(image_data)

        logger.info(f"Screenshot saved to {filename}")
        return filename


def main():
    """Demonstrate all client features"""

    # Initialize client
    client = BassetHoundClient()

    try:
        # Connect
        client.connect()
        logger.info("=" * 60)
        logger.info("Basset Hound Client - Feature Demonstration")
        logger.info("=" * 60)

        # 1. Navigation
        logger.info("\n1. Navigation Test")
        logger.info("-" * 60)
        result = client.navigate("https://example.com", wait_for="h1")
        logger.info(f"Navigated to: {result['url']}")
        logger.info(f"Tab ID: {result['tabId']}")

        # Wait a moment
        time.sleep(2)

        # 2. Get Page State
        logger.info("\n2. Page State Extraction")
        logger.info("-" * 60)
        state = client.get_page_state()
        logger.info(f"Title: {state['title']}")
        logger.info(f"URL: {state['url']}")
        logger.info(f"Forms found: {len(state.get('forms', []))}")
        logger.info(f"Links found: {len(state.get('links', []))}")
        logger.info(f"Buttons found: {len(state.get('buttons', []))}")

        # 3. Content Extraction
        logger.info("\n3. Content Extraction")
        logger.info("-" * 60)
        content = client.get_content("h1")
        logger.info(f"H1 text: {content['content'][:100]}...")

        # 4. Screenshot
        logger.info("\n4. Screenshot Capture")
        logger.info("-" * 60)
        filename = client.save_screenshot("/tmp/example-screenshot.png")
        logger.info(f"Screenshot saved: {filename}")

        # 5. JavaScript Execution
        logger.info("\n5. JavaScript Execution")
        logger.info("-" * 60)
        link_count = client.execute_script("document.querySelectorAll('a').length")
        logger.info(f"Links on page: {link_count}")

        # 6. Cookie Retrieval
        logger.info("\n6. Cookie Retrieval")
        logger.info("-" * 60)
        cookies = client.get_cookies()
        logger.info(f"Cookies found: {len(cookies)}")
        for cookie in cookies[:3]:  # Show first 3
            logger.info(f"  - {cookie.get('name')}: {cookie.get('value', '')[:30]}...")

        # 7. Form Detection
        logger.info("\n7. Form Detection")
        logger.info("-" * 60)
        forms = client.detect_forms()
        logger.info(f"Forms detected: {len(forms)}")

        # 8. CAPTCHA Detection
        logger.info("\n8. CAPTCHA Detection")
        logger.info("-" * 60)
        captcha = client.detect_captcha()
        logger.info(f"CAPTCHAs found: {captcha.get('hasCaptcha', False)}")

        # 9. Advanced Form Filling Example
        logger.info("\n9. Navigate to Form Test Page")
        logger.info("-" * 60)
        # Note: This would work with a real form
        logger.info("Example form filling (commented out - needs real form):")
        logger.info("""
        client.navigate("https://httpbin.org/forms/post")
        client.fill_form({
            "[name='custname']": "John Doe",
            "[name='custtel']": "555-1234",
            "[name='custemail']": "john@example.com",
            "[name='size'][value='medium']": True,
            "[name='topping'][value='bacon']": True
        }, submit=False)
        """)

        logger.info("\n" + "=" * 60)
        logger.info("All tests completed successfully!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Error during demonstration: {e}", exc_info=True)

    finally:
        # Disconnect
        client.disconnect()


if __name__ == "__main__":
    main()
