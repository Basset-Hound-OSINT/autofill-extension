#!/usr/bin/env python3
"""
Basset Hound - Form Automation Example

This example demonstrates advanced form automation capabilities:
- Multi-step form filling
- Dynamic form detection
- Conditional field handling
- Form validation
- Error recovery
- File upload handling (where supported)

Requirements:
    pip install websocket-client

Usage:
    python3 form-automation-example.py
"""

import json
import time
import logging
import sys
import os
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FormAutomator:
    """
    Form automation using Basset Hound.

    Demonstrates advanced form handling including:
    - Intelligent form detection
    - Multi-step workflows
    - Validation handling
    - Error recovery
    """

    def __init__(self, ws_url: str = "ws://localhost:8765/browser"):
        """Initialize the automator"""
        from python_client_example import BassetHoundClient
        self.client = BassetHoundClient(ws_url)

    def connect(self):
        """Connect to browser"""
        logger.info("Connecting to Basset Hound extension...")
        self.client.connect()
        logger.info("✓ Connected successfully")

    def disconnect(self):
        """Disconnect from browser"""
        self.client.disconnect()

    def analyze_form(self, form_selector: str = "form") -> Dict[str, Any]:
        """
        Analyze a form's structure and requirements.

        Args:
            form_selector: CSS selector for the form

        Returns:
            Form analysis results
        """
        logger.info(f"Analyzing form: {form_selector}")

        # Get page state which includes forms
        state = self.client.get_page_state()
        forms = state.get('forms', [])

        if not forms:
            logger.warning("No forms found on page")
            return {}

        # Get first form (or find by selector)
        form = forms[0]

        analysis = {
            'form_id': form.get('id', ''),
            'form_name': form.get('name', ''),
            'action': form.get('action', ''),
            'method': form.get('method', 'GET'),
            'field_count': len(form.get('fields', [])),
            'required_fields': [],
            'optional_fields': [],
            'field_types': {}
        }

        # Analyze fields
        for field in form.get('fields', []):
            field_info = {
                'selector': field.get('selector', ''),
                'name': field.get('name', ''),
                'type': field.get('type', ''),
                'label': field.get('label', ''),
                'placeholder': field.get('placeholder', ''),
                'required': field.get('required', False)
            }

            if field_info['required']:
                analysis['required_fields'].append(field_info)
            else:
                analysis['optional_fields'].append(field_info)

            field_type = field_info['type']
            if field_type not in analysis['field_types']:
                analysis['field_types'][field_type] = 0
            analysis['field_types'][field_type] += 1

        logger.info(f"✓ Form analyzed: {analysis['field_count']} fields "
                   f"({len(analysis['required_fields'])} required)")

        return analysis

    def fill_form_intelligently(self, form_data: Dict[str, Any],
                                submit: bool = False,
                                wait_after_fill: int = 1000) -> Dict[str, Any]:
        """
        Fill form with intelligent field matching.

        Args:
            form_data: Dictionary of field names/labels to values
            submit: Whether to submit after filling
            wait_after_fill: Milliseconds to wait after filling

        Returns:
            Fill results
        """
        logger.info("Filling form intelligently...")

        # Get form analysis
        analysis = self.analyze_form()

        if not analysis:
            raise Exception("No form found on page")

        # Build selector-to-value mapping
        fields_to_fill = {}

        # Try to match form_data keys to actual form fields
        for key, value in form_data.items():
            # Try multiple matching strategies
            matched = False

            # Check all fields in form
            all_fields = analysis['required_fields'] + analysis['optional_fields']

            for field in all_fields:
                # Match by name
                if field['name'].lower() == key.lower():
                    fields_to_fill[field['selector']] = value
                    matched = True
                    logger.debug(f"Matched '{key}' to field by name: {field['selector']}")
                    break

                # Match by label
                if field['label'].lower() == key.lower():
                    fields_to_fill[field['selector']] = value
                    matched = True
                    logger.debug(f"Matched '{key}' to field by label: {field['selector']}")
                    break

                # Match by placeholder
                if field['placeholder'].lower() == key.lower():
                    fields_to_fill[field['selector']] = value
                    matched = True
                    logger.debug(f"Matched '{key}' to field by placeholder: {field['selector']}")
                    break

            if not matched:
                logger.warning(f"Could not match field: {key}")

        # Fill the form
        logger.info(f"Filling {len(fields_to_fill)} fields...")
        result = self.client.fill_form(fields_to_fill, submit=submit)

        # Wait after filling
        if wait_after_fill > 0:
            time.sleep(wait_after_fill / 1000)

        return result

    def fill_multi_step_form(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Fill multi-step form workflow.

        Args:
            steps: List of step dictionaries with 'fields' and optional 'next_button'

        Returns:
            List of results for each step
        """
        logger.info(f"Starting multi-step form ({len(steps)} steps)...")

        results = []

        for idx, step in enumerate(steps, 1):
            logger.info(f"\nStep {idx}/{len(steps)}")
            logger.info("-" * 60)

            # Fill step fields
            fields = step.get('fields', {})
            result = self.fill_form_intelligently(fields, submit=False)
            results.append({
                'step': idx,
                'result': result,
                'success': result.get('success', False)
            })

            # Wait for any dynamic updates
            time.sleep(1)

            # Click next button if specified
            next_button = step.get('next_button')
            if next_button:
                logger.info(f"Clicking next button: {next_button}")
                try:
                    self.client.click(next_button, wait_after=2000)
                    logger.info("✓ Moved to next step")
                except Exception as e:
                    logger.error(f"Failed to click next button: {e}")
                    results[-1]['error'] = str(e)
                    break

            # Wait between steps
            wait_time = step.get('wait_after', 2)
            logger.info(f"Waiting {wait_time}s before next step...")
            time.sleep(wait_time)

        logger.info(f"\n✓ Completed {len(results)} steps")
        return results

    def validate_form_submission(self) -> Dict[str, Any]:
        """
        Check if form was submitted successfully.

        Returns:
            Validation results
        """
        logger.info("Validating form submission...")

        # Wait for page to settle
        time.sleep(2)

        # Check for common success indicators
        validation = self.client.execute_script("""
            ({
                url: window.location.href,
                title: document.title,
                hasSuccessMessage: !!(
                    document.querySelector('.success') ||
                    document.querySelector('.alert-success') ||
                    document.querySelector('[role="alert"][class*="success"]') ||
                    document.body.textContent.includes('Success') ||
                    document.body.textContent.includes('Thank you')
                ),
                hasErrorMessage: !!(
                    document.querySelector('.error') ||
                    document.querySelector('.alert-error') ||
                    document.querySelector('.alert-danger') ||
                    document.querySelector('[role="alert"][class*="error"]')
                ),
                hasValidationErrors: document.querySelectorAll('.invalid-feedback, .error-message').length > 0,
                validationErrors: Array.from(
                    document.querySelectorAll('.invalid-feedback, .error-message')
                ).map(el => el.textContent.trim())
            })
        """)

        logger.info(f"Validation complete:")
        logger.info(f"  Success message: {validation['hasSuccessMessage']}")
        logger.info(f"  Error message: {validation['hasErrorMessage']}")
        logger.info(f"  Validation errors: {validation['hasValidationErrors']}")

        return validation

    def handle_dynamic_fields(self, trigger_selector: str,
                            wait_for_selector: str,
                            timeout: int = 10) -> bool:
        """
        Handle dynamically appearing fields.

        Args:
            trigger_selector: Selector for element that triggers new fields
            wait_for_selector: Selector for new field to wait for
            timeout: Timeout in seconds

        Returns:
            True if field appeared
        """
        logger.info(f"Handling dynamic field: {wait_for_selector}")

        # Click trigger
        self.client.click(trigger_selector, wait_after=500)

        # Wait for new field
        try:
            result = self.client.wait_for_element(wait_for_selector, timeout)
            if result.get('found'):
                logger.info("✓ Dynamic field appeared")
                return True
            else:
                logger.warning("Dynamic field did not appear")
                return False
        except Exception as e:
            logger.error(f"Error waiting for dynamic field: {e}")
            return False

    def fill_select_field(self, selector: str, value: str,
                         by: str = 'value') -> Dict[str, Any]:
        """
        Fill a select/dropdown field.

        Args:
            selector: Field selector
            value: Value to select
            by: Selection method ('value', 'text', or 'index')

        Returns:
            Fill result
        """
        logger.info(f"Filling select field: {selector} = {value}")

        if by == 'value':
            return self.client.fill_form({selector: value})
        elif by == 'text':
            # Select by visible text
            script = f"""
                const select = document.querySelector('{selector}');
                if (select) {{
                    const option = Array.from(select.options).find(
                        opt => opt.text === '{value}'
                    );
                    if (option) {{
                        select.value = option.value;
                        select.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }}
                }}
                return false;
            """
            return self.client.execute_script(script)
        elif by == 'index':
            # Select by index
            script = f"""
                const select = document.querySelector('{selector}');
                if (select && select.options[{value}]) {{
                    select.selectedIndex = {value};
                    select.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            """
            return self.client.execute_script(script)


def example_simple_form():
    """Example: Simple single-page form"""
    logger.info("\n" + "=" * 60)
    logger.info("Example 1: Simple Form Filling")
    logger.info("=" * 60)

    automator = FormAutomator()

    try:
        automator.connect()

        # Navigate to form (using httpbin for testing)
        automator.client.navigate("https://httpbin.org/forms/post")
        time.sleep(2)

        # Analyze the form
        analysis = automator.analyze_form()
        logger.info(f"\nForm Analysis:")
        logger.info(f"  Action: {analysis.get('action')}")
        logger.info(f"  Method: {analysis.get('method')}")
        logger.info(f"  Fields: {analysis.get('field_count')}")
        logger.info(f"  Required: {len(analysis.get('required_fields', []))}")

        # Fill the form
        form_data = {
            'custname': 'John Doe',
            'custtel': '555-1234',
            'custemail': 'john@example.com',
            'size': 'medium',
            'topping': 'bacon',
            'delivery': '11:30',
            'comments': 'Extra napkins please'
        }

        result = automator.fill_form_intelligently(form_data, submit=False)
        logger.info(f"\nFill Result: {json.dumps(result, indent=2)}")

        # Take screenshot
        automator.client.save_screenshot("/tmp/form_filled.png")
        logger.info("\n✓ Screenshot saved")

    finally:
        automator.disconnect()


def example_multi_step_form():
    """Example: Multi-step form workflow"""
    logger.info("\n" + "=" * 60)
    logger.info("Example 2: Multi-Step Form")
    logger.info("=" * 60)

    automator = FormAutomator()

    try:
        automator.connect()

        # This is a conceptual example - would need actual multi-step form
        logger.info("\nMulti-step form example (conceptual):")
        logger.info("""
        steps = [
            {
                'fields': {
                    'firstName': 'John',
                    'lastName': 'Doe',
                    'email': 'john@example.com'
                },
                'next_button': '#nextStep1',
                'wait_after': 2
            },
            {
                'fields': {
                    'address': '123 Main St',
                    'city': 'Boston',
                    'zipCode': '02101'
                },
                'next_button': '#nextStep2',
                'wait_after': 2
            },
            {
                'fields': {
                    'cardNumber': '4111111111111111',
                    'expiry': '12/25',
                    'cvv': '123'
                },
                'next_button': '#submit',
                'wait_after': 3
            }
        ]

        results = automator.fill_multi_step_form(steps)

        # Validate submission
        validation = automator.validate_form_submission()
        logger.info(f"Submission validation: {validation}")
        """)

    finally:
        automator.disconnect()


def example_dynamic_form():
    """Example: Form with dynamic fields"""
    logger.info("\n" + "=" * 60)
    logger.info("Example 3: Dynamic Form Fields")
    logger.info("=" * 60)

    automator = FormAutomator()

    try:
        automator.connect()

        logger.info("\nDynamic form example (conceptual):")
        logger.info("""
        # Navigate to form
        automator.client.navigate("https://example.com/dynamic-form")

        # Fill initial fields
        automator.fill_form_intelligently({
            'accountType': 'business'
        })

        # Wait for business-specific fields to appear
        automator.handle_dynamic_fields(
            trigger_selector='#accountType',
            wait_for_selector='#companyName',
            timeout=5
        )

        # Fill newly appeared fields
        automator.fill_form_intelligently({
            'companyName': 'Acme Corp',
            'taxId': '12-3456789'
        })
        """)

    finally:
        automator.disconnect()


def main():
    """Run form automation examples"""

    try:
        # Example 1: Simple form
        example_simple_form()

        # Example 2: Multi-step form (conceptual)
        example_multi_step_form()

        # Example 3: Dynamic form (conceptual)
        example_dynamic_form()

        logger.info("\n" + "=" * 60)
        logger.info("All form automation examples completed!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Error in examples: {e}", exc_info=True)


if __name__ == "__main__":
    main()
