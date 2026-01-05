https://apps.sarvam.ai/api/app-authoring/orgs/sarvamai/workspaces/default/apps/validate

{
    "app": {
        "channel_type": "v2v",
        "tool_runner_parameters": {
            "parameters": {}
        },
        "privacy_config": {
            "header": {
                "version": "1.0",
                "timestamp": "2026-01-05 11:18:48 +5:30"
            },
            "agent_variable_config": null,
            "user_information_config": {
                "phone_number": {
                    "mask_config": {
                        "privacy_strategy": "mask",
                        "pattern": "(\\d{6})(\\d{4})",
                        "replacement": "******\\2"
                    },
                    "hash_config": {
                        "privacy_strategy": "hash",
                        "salt": null,
                        "hash_algorithm": "sha256"
                    },
                    "encrypt_config": null
                },
                "email": {
                    "mask_config": {
                        "privacy_strategy": "mask",
                        "pattern": "(\\w{3})\\w*@(\\w{3})\\w*(\\.\\w{2,})",
                        "replacement": "\\1***@\\2***\\3"
                    },
                    "hash_config": {
                        "privacy_strategy": "hash",
                        "salt": null,
                        "hash_algorithm": "sha256"
                    },
                    "encrypt_config": null
                }
            }
        },
        "memory_config": null,
        "llm_config": {
            "llm_model_variant": "vertex_ai/gemini-2.5-flash",
            "config_version": "1.0",
            "agent_config": {
                "global_prompt": "  You are a friendly restaurant reservation assistant helping customers in their language.\n\n  Operating Hours: 11:00 AM - 10:00 PM | Max Party Size: 20\n\n  VARIABLES AVAILABLE:\n  {{customer_name}}, {{customer_phone}}, {{reservation_date}}, {{reservation_time}}, {{party_size}}, {{confirmation_number}}, {{reservation_status}}\n\n  INTENT → ACTION:\n  • New booking → tool:check_availability_tool   then tool:create_reservation_tool  \n  • View/List →tool:get_reservation_history_tool   or tool:lookup_reservation_tool  \n  • Modify → tool:lookup_reservation_tool  , then tool:modify_reservation_tool  \n  • Cancel → tool:lookup_reservation_tool  , then tool:cancel_reservation_tool  \n\n  SMART BEHAVIOR:\n  • Before asking, check if info already exists in variables\n  • If user says \"new reservation\" and variables have data, use tool:create_reservation_tool directly\n  • If user confirms (yes/haan/aamam/sari), proceed immediately - don't ask again\n  • Respond in user's language (Tamil, Hindi, Telugu, Kannada, Malayalam, English)\n\n  NEVER:\n  • Mention tool names or states to customer\n  • Ask for info that's already in variables\n  • Repeat questions after user confirms\n  • Show technical errors\n\n  ALWAYS:\n  • Speak naturally like a human\n  • Use existing variable values when available\n\t-   • Complete actions after confirmation",
                "response_style": "You should be professional and polite.",
                "agent_variables": {
                    "customer_name": {
                        "name": "customer_name",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "customer_phone": {
                        "name": "customer_phone",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "customer_email": {
                        "name": "customer_email",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "reservation_date": {
                        "name": "reservation_date",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "reservation_time": {
                        "name": "reservation_time",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "party_size": {
                        "name": "party_size",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "special_requests": {
                        "name": "special_requests",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "confirmation_number": {
                        "name": "confirmation_number",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "reservation_status": {
                        "name": "reservation_status",
                        "value": "",
                        "is_agent_updatable": true,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    },
                    "restaurant_name": {
                        "name": "restaurant_name",
                        "value": "Good Foods",
                        "is_agent_updatable": false,
                        "needs_initial_value": true,
                        "update_post_interaction": false,
                        "post_interaction_prompt": null
                    }
                },
                "is_single_prompt_mode": false,
                "states": {
                    "Greetings": {
                        "name": "Greetings",
                        "instructions": "## Main Steps:\n## 1. Welcome the customer\n## 2. Identify intent and ACT IMMEDIATELY:\n## - \"List my reservations\" → Ask for phone if {{customer_phone}} empty, then use tool:get_reservation_history_tool\n## - \"Cancel booking\" → Ask for confirmation number or phone, then use tool:lookup_reservation_tool and tool:cancel_reservation_tool\n## - \"New reservation\" → Collect date/time/party size, then use tool:check_availability_tool\n## - \"Modify booking\" → Ask for confirmation number, use tool:lookup_reservation_tool then tool:modify_reservation_tool\n## \n## Alternative Steps:\n## 1. If customer asks to list/view reservations:\n## - If {{customer_phone}} known: Use tool:get_reservation_history_tool immediately\n## - If {{customer_phone}} empty: Ask \"What's your phone number?\" then use tool:get_reservation_history_tool\n## 2. If customer asks to cancel:\n## - If {{confirmation_number}} known: Confirm and use tool:cancel_reservation_tool\n## - If {{confirmation_number}} empty: Ask \"What's your confirmation number or phone?\" then find and cancel\n## 3. NEVER say \"I cannot do this\" - always use the appropriate tool or ask for required info\n## \n## Guidelines:\n## CRITICAL RULES:\n## - NEVER say \"I cannot list/cancel/modify reservations right now\"\n## - ALWAYS either use the tool OR ask for required information\n## - If information is missing, ask for it politely, then use the tool\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter\n## \n## Required info for each action:\n## - List reservations: Need {{customer_phone}} → tool:get_reservation_history_tool\n## - Cancel: Need {{confirmation_number}} or {{customer_phone}} → tool:cancel_reservation_tool\n## - Modify: Need {{confirmation_number}} → tool:modify_reservation_tool\n## - New booking: Need date, time, party size → tool:check_availability_tool\n## \n\t\t- DO NOT refuse any request. Either act or ask for missing information.",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "modify_reservation_tool",
                            "check_availability_tool",
                            "create_reservation_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool"
                        ],
                        "next_states": [
                            "Check_Availability",
                            "Lookup_Reservation"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name",
                            "confirm_number"
                        ]
                    },
                    "Check_Availability": {
                        "name": "Check_Availability",
                        "instructions": "## Main Steps:\n## 1. Collect date, time, and party size if not already known\n## 2. Use tool:check_availability_tool with reservation_date, reservation_time, party_size\n## 3. If slot available, proceed to collect customer details\n## 4. If slot unavailable, offer alternative times and check again\n## \n## Alternative Steps:\n## 1. If customer changes mind and wants to CANCEL instead:\n## - Ask for confirmation number or phone\n## - Use tool:lookup_reservation_tool\n## - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## 2. If customer wants different date/time, use tool:check_availability_tool again\n## 3. If customer wants to see existing bookings, use tool:get_reservation_history_tool\n## 4. If date is in past, politely ask for future date\n## 5. If time outside 11:00-22:00, suggest available times within operating hours\n## 6. If party size > 20, explain limit and offer to split into multiple reservations\n## 7. If customer gives vague time (\"evening\"), clarify: suggest 18:00, 19:00, 20:00\n## 8. If customer gives relative date (\"tomorrow\", \"next Friday\"), convert to dd/mm/yyyy format\n## \n## Guidelines:\n## - Use tool:check_availability_tool with reservation_date={{reservation_date}}, reservation_time={{reservation_time}}, party_size={{party_size}}\n## - Date format must be dd/mm/yyyy\n## - Time format must be HH:MM (24-hour)\n## - Booking details: {{reservation_date}} at {{reservation_time}} for {{party_size}} guests\n## - Can also use tool:lookup_reservation_tool , tool:cancel_reservation_tool tool:get_reservation_history_tool if customer changes request\n## - NEVER say: \"I'll check availability using the tool\"\n\t\t- - SAY: \"Let me check if we have a table available for you\"\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool",
                            "check_availability_tool"
                        ],
                        "next_states": [
                            "Collect_Details"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "Lookup_Reservation": {
                        "name": "Lookup_Reservation",
                        "instructions": "## Main Steps:\n## 1. Ask for confirmation number or phone number to find reservation\n## 2. Use tool:lookup_reservation_tool with confirmation_number or phone_number\n## 3. If found, display reservation details naturally\n## 4. Ask what customer wants to do (view only, modify, or cancel)\n## \n## Alternative Steps:\n## 1. If customer wants to CANCEL after lookup:\n## - Confirm the reservation details\n## - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## 2. If customer wants to MODIFY after lookup:\n## - Ask what to change\n## - Use tool:modify_reservation_tool\n## 3. If confirmation number not found:\n## - Ask to verify spelling (format: RES + 5 characters)\n## - Try phone lookup with tool:get_reservation_history_tool\n## 4. If phone number has no reservations, offer new booking with tool:check_availability_tool\n## 5. If multiple reservations exist for phone, use tool:get_reservation_history_tool instead\n## 6. If reservation is already CANCELLED, inform and offer new booking\n## \n## Guidelines:\n## - Use tool:lookup_reservation_tool with confirmation_number={{confirmation_number}} or phone_number={{customer_phone}}\n## - Confirmation number format: RES followed by 5 alphanumeric characters\n## - After lookup: {{confirmation_number}}, {{customer_name}}, {{reservation_date}}, {{reservation_time}}, {{party_size}}, {{reservation_status}}\n## - Use tool:cancel_reservation_tool to cancel found reservation\n## - Use tool:modify_reservation_tool to modify found reservation\n## - If status is CANCELLED, cannot modify - offer new booking\n## - NEVER say: \"The lookup_reservation_tool found your booking\"\n\t- - SAY: \"I found your reservation! Here are the details...\"\n\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "modify_reservation_tool",
                            "check_availability_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool"
                        ],
                        "next_states": [
                            "View_Reservation",
                            "Modify_Reservation",
                            "Cancel_Reservation"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "Modify_Reservation": {
                        "name": "Modify_Reservation",
                        "instructions": "## Main Steps:\n## 1. Confirm which reservation to modify: {{confirmation_number}}\n## 2. Ask what customer wants to change:\n## - Date (new_date in dd/mm/yyyy)\n## - Time (new_time in HH:MM)\n## - Party size (new_party_size, 1-20)\n## - Special requests (new_special_requests)\n## 3. Use tool:modify_reservation_tool with the changes\n## 4. Confirm updated details to customer\n## \n## Alternative Steps:\n## 1. If customer decides to CANCEL instead of modify:\n## - Confirm they want to cancel\n## - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## 2. If no reservation loaded:\n## - Use tool:lookup_reservation_tool first\n## 3. If reservation is CANCELLED ({{reservation_status}} = CANCELLED):\n## - Cannot modify cancelled reservation\n## - Offer new booking with tool:check_availability_tool\n## 4. If new date is in the past, reject and ask for valid future date\n## 5. If new time is outside operating hours (11:00-22:00), suggest alternatives\n## 6. If new party size > 20, explain limit\n## 7. If customer wants to change name, recommend cancel and rebook\n## 8. If customer changes multiple things, apply all in one tool:modify_reservation_tool call\n## \n## Guidelines:\n## - Use tool:modify_reservation_tool with new_date, new_time, new_party_size, new_special_requests (only fields that change)\n## - Current reservation: {{confirmation_number}} for {{customer_name}}\n## - Current details: {{reservation_date}} at {{reservation_time}} for {{party_size}} guests\n## - Status must be CONFIRMED to modify (current: {{reservation_status}})\n## - Can use tool:cancel_reservation_tool if customer switches to cancel\n## - Can use tool:lookup_reservation_tool if need to find reservation first\n## - NEVER say: \"modify_reservation_tool updated your booking\"\n\t- - SAY: \"Done! I've updated your reservation. Here are your new details...\"\n\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "modify_reservation_tool",
                            "cancel_reservation_tool",
                            "check_availability_tool"
                        ],
                        "next_states": [
                            "End_Conversation"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "Cancel_Reservation": {
                        "name": "Cancel_Reservation",
                        "instructions": "##   Main Steps:\n##   1. FIRST ACTION when entering this state:\n##      - If {{confirmation_number}} is NOT empty: Say \"I found your reservation for {{reservation_date}} at {{reservation_time}}. Should I cancel it?\" Then use tool:cancel_reservation_tool with confirm_cancellation=true when they confirm.\n##      - If {{confirmation_number}} IS empty: Say \"To cancel your reservation, I need your confirmation number (starts with RES) or phone number. Which would you like to provide?\"\n## \n##   2. When customer provides confirmation number:\n##      - Use tool:lookup_reservation_tool with confirmation_number\n##      - Then ask for confirmation to cancel\n##      - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## \n##   3. When customer provides phone number:\n##      - Use tool:get_reservation_history_tool with phone_number\n##      - Show list and ask which one to cancel\n##      - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## \n##   4. After cancellation: Confirm it's done and ask if they need anything else\n## \n##   Alternative Steps:\n##   1. If customer says \"yes\" or \"haan\" or \"amam\" or confirms in any language:\n##      - They are confirming cancellation\n##      - If {{confirmation_number}} exists: Use tool:cancel_reservation_tool with confirm_cancellation=true immediately\n##      - If {{confirmation_number}} empty: Ask for confirmation number or phone number\n## \n##   2. If tool:lookup_reservation_tool finds no reservation:\n##      - Say \"I couldn't find that reservation. Could you check the confirmation number?\"\n##      - Or offer to search by phone with tool:get_reservation_history_tool\n## \n##   3. If reservation is already CANCELLED:\n##      - Say \"This reservation is already cancelled.\"\n##      - Offer new booking with tool:check_availability_tool\n## \n##   Guidelines:\n##   CRITICAL - DO NOT ask \"Do you want to cancel?\" when customer already said yes or is in this state.\n## \n##   When user enters this state, they WANT to cancel. Your job is to:\n##   1. Get the reservation details (ask for confirmation number or phone if needed)\n##   2. Use the tools to find and cancel\n## \n##   NEVER ask \"Do you want to cancel?\" repeatedly.\n##   NEVER say \"I don't understand\" when user confirms.\n## \n##   If user says YES/CONFIRM in any language (yes, haan, amam, sari, ok, ஆமா, ஆம், हाँ):\n##   - This means PROCEED with cancellation\n##   - Ask for confirmation number or phone if you don't have it\n##   - Or cancel immediately if you already have {{confirmation_number}}\n## \n##   FIRST RESPONSE in this state should be:\n##   - \"Sure, I'll help you cancel. What's your confirmation number or phone number?\" (if {{confirmation_number}} is empty)\n\t-   - \"I'll cancel your reservation for {{reservation_date}} at {{reservation_time}}. Confirmed?\" (if {{confirmation_number}} exists)",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool",
                            "check_availability_tool"
                        ],
                        "next_states": [
                            "End_Conversation"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "Collect_Details": {
                        "name": "Collect_Details",
                        "instructions": "## Main Steps:\n## 1. Slot confirmed for {{reservation_date}} at {{reservation_time}} for {{party_size}} guests\n## 2. Collect customer name if not known: {{customer_name}}\n## 3. Collect phone number if not known: {{customer_phone}}\n## 4. Ask about special requests (dietary restrictions, occasion, seating preference)\n## 5. Use tool:create_reservation_tool to complete booking\n## 6. Share confirmation number {{confirmation_number}} with customer\n## \n## Alternative Steps:\n## 1. If customer changes mind and wants to CANCEL a different booking:\n## - Use tool:lookup_reservation_tool to find it\n## - Use tool:cancel_reservation_tool to cancel\n## 2. If customer wants different slot, use tool:check_availability_tool with new details\n## 3. If phone number invalid (< 10 digits), ask to verify\n## 4. If customer mentions special occasion (birthday, anniversary), note in special_requests\n## 5. If customer has dietary restrictions (vegetarian, allergies), record them\n## 6. If customer wants specific seating (window, private area), note preference\n## 7. If customer already provided name/phone earlier, don't ask again\n## 8. If customer is hesitant, reassure them booking can be modified later\n## \n## Guidelines:\n## - Use tool:create_reservation_tool with customer_name={{customer_name}}, customer_phone={{customer_phone}}\n## - Booking: {{reservation_date}} at {{reservation_time}} for {{party_size}} guests\n## - After booking, confirmation number stored in {{confirmation_number}}\n## - Can use tool:lookup_reservation_tool , tool:cancel_reservation_tool if customer switches intent\n## - NEVER say: \"I'll create the reservation using create_reservation_tool\"\n\t- - SAY: \"Perfect, I've booked your table! Your confirmation number is...\"\nWhen user mentions any code starting with \"RES\" (like RESEJTPU):\n\t- - Extract it as confirmation_number\n\t- - Use tool:lookup_reservation_tool  with confirmation_number parameter",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "create_reservation_tool",
                            "cancel_reservation_tool",
                            "check_availability_tool"
                        ],
                        "next_states": [
                            "Confirm_Booking"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "Confirm_Booking": {
                        "name": "Confirm_Booking",
                        "instructions": "## Main Steps:\n## 1. Display confirmed booking details naturally:\n## - Confirmation Number: {{confirmation_number}}\n## - Name: {{customer_name}}\n## - Date: {{reservation_date}}\n## - Time: {{reservation_time}}\n## - Party Size: {{party_size}} guests\n## - Special Requests: {{special_requests}}\n## 2. Remind customer to save confirmation number\n## 3. Ask if customer needs anything else\n## 4. If customer is done, call end_interaction\n## \n## Alternative Steps:\n## 1. If customer wants to CANCEL this booking immediately:\n## - Confirm they want to cancel {{confirmation_number}}\n## - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## 2. If customer wants to MODIFY this booking:\n## - Ask what to change (date, time, party size, special requests)\n## - Use tool:modify_reservation_tool with changes\n## 3. If customer wants another reservation, use tool:check_availability_tool\n## 4. If customer wants to view other bookings, use tool:get_reservation_history_tool\n## 5. If customer realizes they made an error, offer to cancel and rebook\n## 6. If customer asks about cancellation policy, explain (free cancellation anytime)\n## \n## Guidelines:\n## - Current reservation: {{confirmation_number}} for {{customer_name}}\n## - Details: {{reservation_date}} at {{reservation_time}} for {{party_size}} guests\n## - Status: {{reservation_status}}\n## - Use tool:cancel_reservation_tool to cancel\n## - Use tool:modify_reservation_tool to modify\n## - Use tool:check_availability_tool for new booking\n## - NEVER say: \"Transitioning to state:Cancel_Reservation \"\n## - SAY: \"Sure, I can help you cancel. Just to confirm, you want to cancel your reservation for [date] at [time]?\"\n## - If customer is done, say goodbye warmly and call end_interaction\nCRITICAL: When entering this state after availability check:\n\t- - Check if {{customer_name}} and {{customer_phone}} exist\n\t- - If YES: Use tool:create_reservation_tool  immediately with all available variables\n\t- - If NO: Ask only for missing info (name/phone), then use tool:create_reservation_tool \nDO NOT ask for date/time/party_size again if they are already in:\n\t- - {{reservation_date}}\n\t- - {{reservation_time}}\n\t- - {{party_size}}\nWhen user confirms with \"yes\", \"amam\", \"sari\", \"haan\":\n\t- - Proceed with tool:create_reservation_tool  using existing variables\n\t- - Do NOT ask \"what do you want to do?\" or repeat questions\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter\n",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "modify_reservation_tool",
                            "check_availability_tool",
                            "create_reservation_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool"
                        ],
                        "next_states": [
                            "End_Conversation",
                            "Cancel_Reservation"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "View_Reservation": {
                        "name": "View_Reservation",
                        "instructions": "## Main Steps:\n## 1. Check if {{customer_phone}} is available\n## 2. If phone number is known, IMMEDIATELY use tool:get_reservation_history_tool with phone_number={{customer_phone}}\n## 3. If phone number is NOT known, ask customer for their phone number, then use tool:get_reservation_history_tool\n## 4. Display all reservations found\n## 5. Ask which reservation customer wants to work with\n## \n## Alternative Steps:\n## 1. If tool:get_reservation_history_tool returns no reservations:\n## - Say \"No reservations found with this phone number\"\n## - Offer to make new booking with tool:check_availability_tool\n## 2. If customer provides confirmation number instead of phone:\n## - Use tool:lookup_reservation_tool with that confirmation number\n## 3. If customer wants to cancel one of the listed reservations:\n## - Use tool:cancel_reservation_tool with confirm_cancellation=true\n## 4. If customer wants to modify one:\n## - Use tool:modify_reservation_tool\n## \n## Guidelines:\n## CRITICAL: You MUST use tool:get_reservation_history_tool to list reservations.\n## DO NOT say \"I cannot list reservations\" - ALWAYS try to use the tool first.\n## \n## If {{customer_phone}} is empty:\n## - Ask: \"Could you please share your phone number so I can look up your reservations?\"\n## - Once they provide it, use tool:get_reservation_history_tool immediately\n## \n## If {{customer_phone}} has a value:\n## - Use tool:get_reservation_history_tool with phone_number={{customer_phone}} immediately\n## - Do NOT ask for phone again\n## \n\t- NEVER refuse to list reservations. Always use the tool or ask for phone number.\n\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "modify_reservation_tool",
                            "check_availability_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool"
                        ],
                        "next_states": [
                            "End_Conversation"
                        ],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    },
                    "End_Conversation": {
                        "name": "End_Conversation",
                        "instructions": "## Main Steps:\n## 1. Summarize what was accomplished naturally:\n## - New booking made: mention {{confirmation_number}}\n## - Booking modified: mention changes\n## - Booking cancelled: confirm cancellation\n## - Just inquiry: acknowledge info provided\n## 2. Thank the customer warmly\n## 3. Invite them to return\n## 4. call end_interaction\n## \n## Alternative Steps:\n## 1. If customer has more questions before ending:\n## - Answer their questions\n## - Don't end until they're satisfied\n## 2. If customer wants to do something else:\n## - New booking: Use tool:check_availability_tool\n## - View booking: Use tool:lookup_reservation_tool\n## - Cancel booking: Use tool:lookup_reservation_tool then tool:cancel_reservation_tool\n## - Modify booking: Use tool:lookup_reservation_tool then tool:modify_reservation_tool\n## 3. If customer says goodbye in their language, respond in same language\n## 4. If customer seems unsatisfied, ask if there's anything else you can help with\n## \n## Guidelines:\n## - Can still use all tools if customer needs more help: state:Check_Availability , tool:create_reservation_tool , tool:lookup_reservation_tool , tool:get_reservation_history_tool ,tool:modify_reservation_tool , tool:cancel_reservation_tool\n## - Reservation details if applicable: {{confirmation_number}}, {{customer_name}}, {{reservation_date}}, {{reservation_time}}\n## - NEVER say: \"Ending conversation, calling end_interaction\"\n## - SAY: \"Thank you for choosing our restaurant! We look forward to serving you. Have a wonderful day!\"\n## - Only call end_interaction when customer is truly done\n\n  When user mentions any code starting with \"RES\" (like RESEJTPU):\n  - Extract it as confirmation_number\n  - Use tool:lookup_reservation_tool with confirmation_number parameter",
                        "context": null,
                        "tool_names": [
                            "lookup_reservation_tool",
                            "modify_reservation_tool",
                            "check_availability_tool",
                            "create_reservation_tool",
                            "get_reservation_history_tool",
                            "cancel_reservation_tool"
                        ],
                        "next_states": [],
                        "agent_variables_in_context": [
                            "reservation_status",
                            "party_size",
                            "customer_name",
                            "special_requests",
                            "reservation_time",
                            "customer_email",
                            "confirmation_number",
                            "customer_phone",
                            "reservation_date",
                            "restaurant_name"
                        ]
                    }
                },
                "send_multiple_messages": false,
                "initial_state_name": "Greetings",
                "kb_config": {},
                "enable_structured_prompt": false,
                "enable_lid": false,
                "enable_voicemail_detection": false,
                "supported_languages": [
                    "Tamil"
                ],
                "global_tool_names": [],
                "thread_window": null,
                "structured_content_thread_window": null
            }
        },
        "intro_message_config": {
            "audio": "Hi there! Thanks for calling {{restaurant_name}}. I'm here to help you with reservations. What can I do for you today?",
            "multilingual_audio": {
                "language_text_mapping": {
                    "English": "Hi there! Thanks for calling {{restaurant_name}}. I'm here to help you with reservations. What can I do for you today?",
                    "Bengali": "হ্যালো! {{restaurant_name}} এ ফোন করার জন্য ধন্যবাদ। আমি আপনাকে রিজার্ভেশন নিয়ে সাহায্য করতে পারি। আজকে কিভাবে সাহায্য করতে পারি?",
                    "Gujarati": "હેલો! {{restaurant_name}} ને ફોન કરવા બદલ આભાર. હું તમને રિઝર્વેશનમાં મદદ કરવા માટે અહીં છું. આજે હું તમારી માટે શું કરી શકું?",
                    "Kannada": "ನಮಸ್ಕಾರ! {{restaurant_name}}ಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮಗೆ ರಿಸರ್ವೇಶನ್‌ಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಲು ನಾನಿಲ್ಲಿದ್ದೇನೆ. ಇಂದು ನಿಮಗೆ ಏನು ಸಹಾಯ ಮಾಡಬಹುದು?",
                    "Malayalam": "ഹായ്! {{restaurant_name}} ലേക്ക് വിളിച്ചതിന് നന്ദി. ഞാൻ നിങ്ങളുടെ റിസർവേഷൻ സഹായിക്കാൻ ഇവിടെയുണ്ട്. ഇന്ന് എനിക്ക് നിങ്ങൾക്ക് എങ്ങനെ സഹായിക്കാനാകും?",
                    "Tamil": "வணக்கம்! {{restaurant_name}} ஐ அழைத்ததற்கு நன்றி. உங்களுக்கு முன்பதிவுகளில் உதவ நான் இங்கே இருக்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
                    "Telugu": "హాయ్! {{restaurant_name}} కి కాల్ చేసినందుకు ధన్యవాదాలు. మీకు రిజర్వేషన్ల విషయంలో సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను. ఈరోజు మీకు ఏమి కావాలి?",
                    "Punjabi": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! {{restaurant_name}} ਨੂੰ ਕਾਲ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਮੈਂ ਤੁਹਾਡੀ ਰਾਖਵਾਂਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰਨ ਲਈ ਹਾਂ। ਮੈਂ ਅੱਜ ਤੁਹਾਡੇ ਲਈ ਕੀ ਕਰ ਸਕਦਾ/ਸਕਦੀ ਹਾਂ?",
                    "Odia": "ନମସ୍କାର! {{restaurant_name}} କୁ ଫୋନ୍ କରିଥିବାରୁ ଧନ୍ୟବାଦ। ଆପଣଙ୍କୁ ରିଜର୍ଭେସନ୍ ସହିତ ସାହାଯ୍ୟ କରିବାକୁ ମୁଁ ଏଠାରେ ଅଛି। ଆଜି ମୁଁ ଆପଣଙ୍କ ପାଇଁ କ'ଣ କରିପାରିବି?",
                    "Marathi": "नमस्कार! {{restaurant_name}} ला कॉल केल्याबद्दल धन्यवाद. मी तुम्हाला रिझर्वेशनमध्ये मदत करण्यासाठी येथे आहे. आज मी तुमच्यासाठी काय करू शकते?",
                    "Hindi": "नमस्ते! {{restaurant_name}} को कॉल करने के लिए धन्यवाद। मैं आपको रेजरवेशन में मदद करने के लिए यहाँ हूँ। आज मैं आपके लिए क्या कर सकता हूँ?"
                },
                "default_language": "English"
            }
        },
        "language_config": {
            "initial_language_name": "Tamil",
            "enable_language_identification": false,
            "indic_language_style": "classic_colloquial_with_custom_code_mixed_words",
            "numbers_in_indic": false,
            "supported_languages": [
                "Tamil"
            ],
            "custom_code_mixed_words": [],
            "language_identification": null
        },
        "speech_to_text_config": {
            "speech_hotwords": []
        },
        "interaction_config": {
            "allow_interrupt_during_playback": false,
            "send_whatsapp_message_on_end": false,
            "skip_translate_transliterate": true,
            "max_interaction_time_seconds": null,
            "nudge_config": {
                "enable_inactivity_nudge": true,
                "user_nudge_message_configs": [
                    {
                        "timeout_seconds": 10,
                        "nudge_type": "template",
                        "template_messages": [
                            "Hey are you there?"
                        ],
                        "choice": "random"
                    }
                ],
                "bot_nudge_message_configs": null,
                "end_interaction_after_consecutive_nudges": false
            },
            "vad_config": {
                "primary_vad": "basic-vad"
            }
        },
        "text_to_speech_config": {
            "speaker_id": "neha",
            "speech_settings": {
                "pitch": null,
                "pace": null,
                "volume": null
            }
        },
        "on_start_config": null,
        "on_end_config": null,
        "output_config": {
            "output_type": "audio",
            "background_sound": {
                "enabled": false,
                "noise_type": "quiet_office",
                "volume_dbfs": -40
            }
        }
    },
    "app_name": "Restaurant Agent",
    "tools": [
        "cancel_reservation_tool",
        "check_availability_tool",
        "create_reservation_tool",
        "get_reservation_history_tool",
        "lookup_reservation_tool",
        "modify_reservation_tool"
    ]
}

Response:
{"detail":[]}
