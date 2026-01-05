https://apps.sarvam.ai/api/app-authoring/orgs/sarvamai/workspaces/default/apps/Restaurant--2346c23a-3842/tools?app_version=5&version_filter=specific

[
  {
    "tool_name": "cancel_reservation_tool",
    "description": "Tool to cancel an existing reservation.\n\nInput Arguments:\n1. confirm_cancellation: Set to true to confirm cancellation (required)\n2. confirmation_number: Confirmation number to cancel (optional - uses from variables if not provided)"
  },
  {
    "tool_name": "check_availability_tool",
    "description": "Tool to check reservation availability for a given date, time, and party size.\n\nInput Arguments:\n1. reservation_date: Date (accepts multiple formats: YYYY-MM-DD, dd/mm/yyyy, etc.)\n2. reservation_time: Time in HH:MM format, 24-hour (required)\n3. party_size: Number of guests, 1-20 (required)"
  },
  {
    "tool_name": "create_reservation_tool",
    "description": "Tool to create a new reservation.\n\nInput Arguments:\n1. customer_name: Name for the reservation (required)\n2. customer_phone: Contact phone number (required)\n3. reservation_date: Date for reservation (optional - uses from variables if not provided)\n4. reservation_time: Time for reservation (optional - uses from variables if not provided)\n5. party_size: Number of guests (optional - uses from variables if not provided)\n6. customer_email: Email address (optional)\n7. special_requests: Dietary restrictions, occasion, etc. (optional)"
  },
  {
    "tool_name": "get_reservation_history_tool",
    "description": "Tool to retrieve all reservations for a customer.\n\nInput Arguments:\n1. phone_number: Customer's phone number (optional - will use from variables if available)"
  },
  {
    "tool_name": "lookup_reservation_tool",
    "description": "Tool to look up an existing reservation.\n\nInput Arguments:\n1. confirmation_number: Reservation confirmation number (optional)\n2. phone_number: Phone number used for booking (optional)\n\nIf neither provided, will try to use values from agent variables."
  },
  {
    "tool_name": "modify_reservation_tool",
    "description": "Tool to modify an existing reservation.\n\nInput Arguments (all optional, provide only what needs to change):\n1. new_date: New date (accepts multiple formats: YYYY-MM-DD, dd/mm/yyyy, etc.)\n2. new_time: New time in HH:MM format\n3. new_party_size: New party size (1-20)\n4. new_special_requests: Updated special requests"
  }
]