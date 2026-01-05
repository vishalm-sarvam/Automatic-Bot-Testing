# Tools Documentation

# Quick Guide to Creating Tools

This is a quick guide as to how to create tools to be used in the Sarvam Agents Platform.

## Tool Structure

Every tool in the Sarvam framework follows a consistent structure. Here are the essential imports you'll need:

```python
# Core SDK imports
from sarvam_agents_sdk import (
    OnStartInput,
    OnStartOutput,
    OnEndInput,
    OnEndOutput,
)

# Tool base classes
from sarvam_tool import BaseTool, ToolOutput

# State management
from sarvam_app_stream import StateContext

# Core tools
from sarvam_core_tools import EndConversation
from sarvam_core_tools._conversation._end_conversation import EndConversationInput
from sarvam_core_tools import TransitionStateInput, TransitionState

```

Every tool in the Sarvam framework follows a consistent structure:

```python
class YourTool(BaseTool):
    """
    Tool description goes here
    """

    # Tool parameters
    param1: Optional[str] = Field(description="Description of param1")
    param2: Optional[int] = Field(description="Description of param2")

    async def run(self, context: StateContext, input_params=None) -> ToolOutput:
        # Tool logic here
        return ToolOutput(...)

```

## Base Components

### BaseTool

The foundation for all tools, providing essential functionality. Not important to know the code, just that whenver you are creating a tool class, always inherit the BaseTool class and it should always contain a  `async def run function`

```python
class BaseTool(BaseModel, Generic[BC, IP]):
    @abstractmethod
    async def run(self, context: BC, input_params: IP) -> ToolOutput:
        raise NotImplementedError

```

### StateContext

Manages the state and variables during tool execution. The StateContext provides methods to interact with different types of variables and chat threads:

```python
def get_agent_variables(self) -> dict[str, Any]:
    """Get the agent variables for the current state."""
    return self._state.agent_variables

def update_agent_variable(self, name: str, value: Any) -> None:
    """Update an agent variable for the current state."""
    self._state.agent_variables[name] = value

def get_system_variables(self) -> dict[str, Any]:
    """Get the system variables for the current state."""
    return self._state.system_variables

def update_system_variable(self, name: str, value: Any) -> None:
    """Update a system variable for the current state."""
    self._state.system_variables[name] = value

def get_internal_variables(self) -> dict[str, Any]:
    """Get the internal variables for the current state."""
    return self._state.internal_variables

def update_internal_variable(self, name: str, value: Any) -> None:
    """Update an internal variable for the current state."""
    self._state.internal_variables[name] = value

def get_chat_llm_thread(self) -> list[LLMMessage]:
    """Get the chat LLM thread for the current state."""
    return self._state.chat_llm_thread

def set_chat_llm_thread(self, messages: list[LLMMessage]):
    """Set the chat LLM thread for the current state."""
    self._state.chat_llm_thread = messages

def append_chat_llm_thread(self, messages: list[LLMMessage]):
    """Append a message to the chat LLM thread for the current state."""
    self._state.chat_llm_thread.extend(
        [i for i in messages if i.state_seq_id not in self._merged_turns]
    )

def get_sarvam_variables(self) -> SarvamVariables:
    """Get the Sarvam variables for the current state, including start datetime and language settings."""
    return SarvamVariables(
        start_datetime=self.get_system_variables().get("start_datetime", ""),
        language_name=self.get_system_variables().get(
            "output_language_name", LanguageName.ENGLISH
        ),
    )

```

Keep in mind that when using these variables, this is the proper manner of using them :

```python
where context = StateContext
# Get all agent variables
variables = context.parent_context.state_machine.get_agent_variables()

# Get specific agent variables
bucket_dpd = context.parent_context.state_machine.get_agent_variables().get("bucket_dpd", "")
due_date = context.parent_context.state_machine.get_agent_variables().get("due_date", "")
user_name = context.parent_context.state_machine.get_agent_variables().get("user_name", "")

# Update agent variables
context.parent_context.state_machine.update_agent_variable("key", "value")

# Internal Variables (not visible to LLM, used for tool-to-tool communication)
internal_variables = context.parent_context.state_machine.get_internal_variables()
num_retry = internal_variables.get("num_retry", 0)  # Get with default value
context.parent_context.state_machine.update_internal_variable("num_retry", num_retry + 1)  # Update internal variable

```

For fetching the entire conversation transcript (no limit) use:
            thread = *context*.parent_context.state_machine._state.interaction_transcript

Key functionalities:

- **Agent Variables**: Store and retrieve variables specific to the agent's operation. Note that all agent variables are stored as strings, so type conversion may be needed when retrieving values.
- **System Variables**: Manage system-level configuration and state
- **Internal Variables**: Handle internal tool-to-tool communication
- **Chat Thread Management**: Control the conversation flow through thread operations
- **Sarvam Variables**: Access platform-specific variables like start time and language settings

### ToolOutput

Defines the output format for tools. The ToolOutput class has three key components that control how responses are handled:

1. **message_to_llm**: This message is processed by the LLM to generate a response for the user. It's used when you want the LLM to interpret or transform the output before sending it to the user.
2. **message_to_user**: This message is sent directly to the user without LLM processing. This approach is generally preferred as it reduces latency and provides more direct control over the user experience.
3. **break_chat_agent_loop**: A boolean flag that determines the response flow:
    - When `True`: The message is sent directly to the user (using message_to_user)
    - When `False`: The message is sent to the LLM for processing (using message_to_llm)
    1. **State Transitions**:

```python
class ToolOutput(BaseModel):
    message_to_llm: Optional[str] = Field(description="Message to LLM")
    message_to_user: Optional[list[Any]] = Field(description="Message to user")
    break_chat_agent_loop: bool = Field(description="Break chat loop(if true, the LLM doesnt respond to the user)", default=True)

```

## Lifecycle Methods

### on_start

Called when the conversation begins. This is where you can initialize variables, configurations, and set up the LLM model:

```python
from sarvam_agents_sdk import OnStartInput, OnStartOutput

# Define the frontier model configuration
# Note: This configuration is only required when using frontier models
# For platform models, you can skip this configuration
model = {
    "llm_provider": "yotta",
    "llm_name": "llama-3.1-70b"
}

async def on_start(on_start_input: OnStartInput) -> OnStartOutput:
    # Get the authoring config and update the LLM model
    authoring_config = on_start_input.authoring_config
    authoring_config["llm_model_name"] = f"{model['llm_provider']}/{model['llm_name']}"

    # Return the initialized configuration
    return OnStartOutput(
        agent_variables=on_start_input.agent_variables,
        internal_variables=on_start_input.internal_variables,
        user_information=on_start_input.user_information,
        authoring_config=authoring_config,
    )

```

Key points about on_start:

- Used to initialize the conversation state
- Can configure the LLM model to use frontier models
- Returns an OnStartOutput with initialized variables and configurations
- The authoring_config can be modified to specify the LLM model to use
- Frontier model configuration is optional and only needed when using frontier models
- For platform models, you can use the default configuration without specifying the model

### on_end

Called when the conversation ends:

```python
async def on_end(on_end_input: OnEndInput) -> None:
    # Cleanup and final processing
    pass

```

## Best Practices

1. **Documentation**: Always include clear docstrings explaining the tool's purpose and parameters
2. **Error Handling**: Implement proper error handling and validation
3. **State Management**: Use StateContext methods to manage variables
4. **Output Format**: Follow the ToolOutput structure for consistent responses
5. **Lifecycle Methods**: Implement on_start and on_end when needed

## Common Patterns

1. **Variable Management**:

```python
# Get all agent variables
variables = context.parent_context.state_machine.get_agent_variables()

# Get specific agent variables
bucket_dpd = context.parent_context.state_machine.get_agent_variables().get("bucket_dpd", "")
due_date = context.parent_context.state_machine.get_agent_variables().get("due_date", "")
user_name = context.parent_context.state_machine.get_agent_variables().get("user_name", "")

# Update agent variables
context.parent_context.state_machine.update_agent_variable("key", "value")

# Internal Variables (not visible to LLM, used for tool-to-tool communication)
internal_variables = context.parent_context.state_machine.get_internal_variables()
num_retry = internal_variables.get("num_retry", 0)  # Get with default value
context.parent_context.state_machine.update_internal_variable("num_retry", num_retry + 1)  # Update internal variable

```

1. **Tool Output**:

```python
# Success case
# Sends the response directly to the user with a success message
return ToolOutput(
    message_to_llm="SUCCESS",
    message_to_user=["Operation completed"],
    break_chat_agent_loop=True
)

# Error case
# Sends the response directly to the user but message to LLM has been included to update the times probed
return ToolOutput(
    message_to_llm="ERROR",
    message_to_user=["Invalid input"],
    break_chat_agent_loop=True
)

```

```python
from sarvam_core_tools import TransitionStateInput, TransitionState
# Transitions to a new state in the conversation flow
transition_state_tool_instance = TransitionState(next_state="NEW_STATE")
await transition_state_tool_instance.run(
    context,
    input_params=TransitionStateInput(
        agent_config=context.parent_context.app.llm_config.agent_config.model_dump()
    )
)

```

1. **Ending Conversations**:

```python
from sarvam_core_tools import EndConversation, EndConversationInput
# Ends the conversation with a final message to the user
end_conv_input = EndConversationInput(nudge_message=message_to_user)
end_conv_tool = EndConversation()
await end_conv_tool.run(context, end_conv_input)
return ToolOutput(
    message_to_llm="CONVERSATION_ENDED",
    message_to_user=[message_to_user],
    break_chat_agent_loop=True,
)

```

1. *Making LLM calls internally within a Tool

```python

model = {
    "name": "enter_model_name_here",
    "url": "enter_url_here",
    "api_key": "enter_api_key_here",
}
llm_config = {"temperature": 0.1, "max_tokens": 512}

async def call_sarvam_model(messages):
    headers = {"Content-Type": "application/json"}
    payload = copy.deepcopy(llm_config)
    payload["stream"] = False
    payload["messages"] = messages
    payload["model"] = model["name"]
    if model.get("api_key"):
        headers["Authorization"] = f"Bearer {model['api_key']}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url=model["url"],
                headers=headers,
                json=payload,
                timeout=60,
            )
            logger.info(
                f"call_sarvam_model: Response status code: {response.status_code}"
            )
            response.raise_for_status()

            model_output = response.json()["choices"][0]["message"]["content"]
            return model_output

    except httpx.HTTPStatusError as exc:
        logger.error(
            "call_sarvam_model: HTTP error occurred - "
            f"Status: {exc.response.status_code}, "
            f"Detail: {exc.response.text}"
        )
        return None
    except Exception as e:
        logger.error(f"call_sarvam_model: Unexpected error occurred: {str(e)}")
        return None

```

Functionality Contributions:

- **Variable Management**: Handles state persistence and tool-to-tool communication
- **Tool Output**: Controls how responses are delivered to users and LLM
- **State Transitions**: Manages conversation flow and state changes
- **Ending Conversations**: Provides a clean way to terminate conversations with final messages
- **Internal LLM Calls** : Provides a way to make LLM calls internally within a tool

## Examples

### 1. Verify Last 4 Digits of Credit Card Number

This tool verifies if the last 4 digits of a credit card number match the user's input.

```python
from typing import Optional
from pydantic import Field
from sarvam_tool import BaseTool, ToolOutput
from sarvam_app_stream import StateContext

class VerifyLast4DigitsTool(BaseTool):
    """
    Tool to verify the last 4 digits of a credit card number for secure authentication purposes.
    This tool compares user-provided digits with the stored account information to verify identity.

    Input Arguments:
    last_4_digits: The 4-digit sequence provided by the user for verification
       - Must be exactly 4 numeric characters (0-9)
       - Will be compared against the stored credit card number's last 4 digits
       - Required parameter, no default value
    """

    # Tool parameters
    last_4_digits: Optional[str] = Field(description="Last 4 digits of the credit card number. Must be exactly 4 numeric characters.")

    async def run(self, context: StateContext, input_params=None) -> ToolOutput:
        # Get the stored credit card number from agent variables
        # Note: Agent variables are stored as strings
        stored_card_number = context.parent_context.state_machine.get_agent_variables().get("credit_card_number", "")

        # Extract last 4 digits from stored card number
        stored_last_4 = stored_card_number[-4:] if stored_card_number else ""

        # Compare with user input
        if self.last_4_digits == stored_last_4:
            return ToolOutput(
                message_to_llm="VERIFICATION_SUCCESSFUL",
                message_to_user=["Last 4 digits verification successful"],
                break_chat_agent_loop=True
            )
        else:
            return ToolOutput(
                message_to_llm="VERIFICATION_FAILED",
                message_to_user=["Last 4 digits verification failed. Please try again."],
                break_chat_agent_loop=True
            )

```

### 2. Calculate Tool

This tool performs basic arithmetic calculations with support for operation chaining and result persistence.
This tool handles common mathematical operations and maintains calculation history.

Input Arguments:

1. operation: The arithmetic operation to perform
    - "add": Addition of two numbers (number1 + number2)
    - "subtract": Subtraction of second number from first (number1 - number2)
    - "multiply": Multiplication of two numbers (number1 * number2)
    - "divide": Division of first number by second (number1 / number2)
    - Required parameter with no default value
2. number1: First operand in the calculation
    - Can be any valid floating-point number
    - Required parameter with no default value
    - Used as the left-hand side operand in all operations
3. number2: Second operand in the calculation
    - Can be any valid floating-point number
    - Required parameter with no default value
    - Used as the right-hand side operand in all operations
    - Cannot be zero when operation is "divide"

Error Handling:

- Division by zero is detected and returns an error message
- Invalid operations return appropriate error messages
- All other exceptions during calculation are caught and reported

State Management:

- Calculation results are stored in agent variables as "last_calculation_result"
- Previous results can be retrieved for use in subsequent calculations
- All results are stored as strings and converted as needed

Output States:

- CALCULATION_SUCCESSFUL: When calculation completes successfully
- DIVISION_BY_ZERO: When attempting to divide by zero
- INVALID_OPERATION: When an unsupported operation is requested
- CALCULATION_ERROR: When any other error occurs during calculation

Note: This tool maintains calculation history and can be used as part of a
multi-step calculation workflow where results are preserved between calls.

```python
from typing import Optional
from pydantic import Field
from sarvam_tool import BaseTool, ToolOutput
from sarvam_app_stream import StateContext

class CalculateTool(BaseTool):
    """
    Tool to perform basic arithmetic calculations with support for operation chaining and result persistence.
    This tool handles common mathematical operations and maintains calculation history.

    Input Arguments:
    1. operation: The arithmetic operation to perform
       - "add": Addition of two numbers (number1 + number2)
       - "subtract": Subtraction of second number from first (number1 - number2)
       - "multiply": Multiplication of two numbers (number1 * number2)
       - "divide": Division of first number by second (number1 / number2)
       - Required parameter with no default value

    2. number1: First operand in the calculation
       - Can be any valid floating-point number
       - Required parameter with no default value
       - Used as the left-hand side operand in all operations

    3. number2: Second operand in the calculation
       - Can be any valid floating-point number
       - Required parameter with no default value
       - Used as the right-hand side operand in all operations
       - Cannot be zero when operation is "divide"
    """

    # Tool parameters
    operation: Optional[str] = Field(description="Arithmetic operation to perform. Must be one of: add, subtract, multiply, divide")
    number1: Optional[float] = Field(description="First number for calculation (left-hand operand)")
    number2: Optional[float] = Field(description="Second number for calculation (right-hand operand). Cannot be zero for divide operation")

    async def run(self, context: StateContext, input_params=None) -> ToolOutput:
        try:
            # Get previous result from agent variables if it exists
            # Note: Agent variables are stored as strings, so we need to convert
            prev_result = context.parent_context.state_machine.get_agent_variables().get("last_calculation_result", "")
            if prev_result:
                prev_result = float(prev_result)

            # Perform the calculation based on the operation
            if self.operation == "add":
                result = self.number1 + self.number2
                operation_symbol = "+"
            elif self.operation == "subtract":
                result = self.number1 - self.number2
                operation_symbol = "-"
            elif self.operation == "multiply":
                result = self.number1 * self.number2
                operation_symbol = "*"
            elif self.operation == "divide":
                if self.number2 == 0:
                    return ToolOutput(
                        message_to_llm="DIVISION_BY_ZERO",
                        message_to_user=["Cannot divide by zero"],
                        break_chat_agent_loop=True
                    )
                result = self.number1 / self.number2
                operation_symbol = "/"
            else:
                return ToolOutput(
                    message_to_llm="INVALID_OPERATION",
                    message_to_user=["Invalid operation specified"],
                    break_chat_agent_loop=True
                )

            # Store the result as a string in agent variables
            context.parent_context.state_machine.update_agent_variable("last_calculation_result", str(result))

            # Format the result message
            message = f"{self.number1} {operation_symbol} {self.number2} = {result}"

            return ToolOutput(
                message_to_llm="CALCULATION_SUCCESSFUL",
                message_to_user=[message],
                break_chat_agent_loop=True
            )

        except Exception as e:
            return ToolOutput(
                message_to_llm="CALCULATION_ERROR",
                message_to_user=[f"Error in calculation: {str(e)}"],
                break_chat_agent_loop=True
            )

```

### 3. Date Validation Tool

This tool is used for date validation.

```python
import os
import logging
from sarvam_tool import BaseTool, ToolOutput
from pydantic import Field
from sarvam_app_stream import StateContext
from datetime import datetime, timedelta
from sarvam_core_tools import EndConversation
from sarvam_core_tools._conversation._end_conversation import EndConversationInput
from typing import Optional
from dateutil.relativedelta import relativedelta

log_level = os.getenv("LOG_LEVEL", "WARNING")
logging.basicConfig(level=log_level)
logger = logging.getLogger(__name__)

today_date = datetime.now()
tomorrow_date = (today_date + timedelta(days=1)).strftime("%d/%m/%Y")
today_date = today_date.strftime("%d/%m/%Y")

def get_upcoming_date(context, weekday_str):
    weekday_map = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }

    today = datetime.now().date()  # get just the date part
    target_weekday = weekday_map[weekday_str.lower()]
    current_weekday = today.weekday()

    days_ahead = target_weekday - current_weekday
    if days_ahead <= 0:
        context.parent_context.state_machine.update_agent_variable("disposition", "PTP")
        days_ahead += 7

    target_date = today + timedelta(days=days_ahead)
    return target_date

def format_date(date_string):
    if date_string == "" or date_string == None:
        return ""
    date_object = datetime.strptime(date_string, "%d/%m/%Y")
    day = date_object.day
    if 4 <= day <= 20 or 24 <= day <= 30:
        suffix = "th"
    else:
        suffix = ["st", "nd", "rd"][day % 10 - 1]
    formatted_date = date_object.strftime(f"%d{suffix} %B %Y")
    return formatted_date

def format_number(number):
    """
    Converts a number into the Indian comma format.
    If the number already contains commas, it leaves it unchanged.
    """
    number = str(number)
    if "," in number:
        return number
    parts = number.split(".")
    integer_part = parts[0]
    decimal_part = parts[1] if len(parts) > 1 else ""

    formatted_integer = integer_part[-3:]
    for i in range(len(integer_part) - 3, 0, -2):
        start = max(0, i - 2)
        formatted_integer = integer_part[start:i] + "," + formatted_integer
    formatted_number = formatted_integer + ("." + decimal_part if decimal_part else "")
    return formatted_number

class DateValidationTool(BaseTool):
    """
    Tool to validate and process date inputs from users. It handles various date formats and validates them against business rules.

    Input Arguments:
    1. date: Use when user provides specific date like "15th March" or "25/03/2024"
       - Must be in dd/mm/yyyy format
       - Leave empty if using other arguments

    2. day_of_week: Use when user mentions a day like "next Monday" or "coming Friday"
       - Pass the day name in lowercase (monday, tuesday etc)
       - Leave empty if using date or delta arguments

    3. day_delta: Use when user says relative days like:
       - "after 5 days" -> day_delta=5
       - "day after tomorrow" -> day_delta=2
       - "tomorrow" -> day_delta=1
       - "today" -> day_delta=0
       - Leave empty if using date, day_of_week or other delta arguments
       - If user says in some time of the day, then fill day_delta with 0.

    4. week_delta: Use when user mentions weeks like:
       - "after 2 weeks" -> week_delta=2
       - "next week" -> week_delta=1
       - Leave empty if using other arguments

    5. month_delta: Use when user mentions months like:
       - "after 3 months" -> month_delta=3
       - "next month" -> month_delta=1
       - Leave empty if using other arguments

    6. year_delta: Use when user mentions years like:
       - "next year" -> year_delta=1
       - "after 2 years" -> year_delta=2
       - Leave empty if using other arguments

    Note: Only use one argument type at a time. The priority order is:
    date > day_of_week > day_delta > week_delta > month_delta > year_delta
    the year is always 2025, the month is always the month of the current date
    """

    date: Optional[str] = Field(
        description="dd/mm/yyyy fashion only. never send anything else here. for relative dates calculate and pass date field in dd/mm/yyyy fashion.",
        default=None,
    )
    day_of_week: Optional[str] = Field(
        description="one of sunday, monday, tuesday, wednesday, thursday, friday, saturday. pass none if date is passed.",
        default=None,
    )
    day_delta: Optional[int] = Field(
        description="number of days to add to today's date. pass none if day_of_week or date is passed.",
        default=None,
    )
    week_delta: Optional[int] = Field(
        description="number of weeks to add to today's date. pass none if day_of_week or date is passed.",
        default=None,
    )
    month_delta: Optional[int] = Field(
        description="number of months to add to today's date. pass none if day_of_week or date is passed.",
        default=None,
    )
    year_delta: Optional[int] = Field(
        description="number of years to add to today's date. pass none if day_of_week or date is passed.",
        default=None,
    )

    async def run(self, context: StateContext, input_params=None) -> ToolOutput:
        """main function to process natural language queries."""
        if self.date:
            try:
                date_str = self.date
                if format_date(
                    date_str
                ) == context.parent_context.state_machine.get_agent_variables().get(
                    "due_date", ""
                ):
                    date_str = (
                        context.parent_context.state_machine.get_agent_variables().get(
                            "user_preferred_date", ""
                        )
                    )
            except ValueError as e:
                return ToolOutput(
                    message_to_llm="INVALID DATE",
                    message_to_user=["Can you please provide a valid date."],
                    break_chat_agent_loop=True,
                )

        internal_variables = (
            context.parent_context.state_machine.get_internal_variables()
        )

        # Log the provided date parameters for debugging purposes.
        logger.debug(
            "Processing date with parameters - day_of_week: %s, day_delta: %s, week_delta: %s, month_delta: %s, year_delta: %s, date: %s",
            self.day_of_week,
            self.day_delta,
            self.week_delta,
            self.month_delta,
            self.year_delta,
            self.date,
        )

        # Use explicit None-checks to correctly handle cases like day_delta = 0.
        if self.day_of_week and self.day_of_week.lower() in [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]:
            logger.debug(
                "Calculating date using day_of_week: %s", self.day_of_week.lower()
            )
            input_date = get_upcoming_date(context, self.day_of_week.lower())
        elif self.day_delta is not None:
            logger.debug("Calculating date using day_delta: %s", self.day_delta)
            input_date = datetime.now().date() + timedelta(days=self.day_delta)
        elif self.week_delta is not None:
            logger.debug("Calculating date using week_delta: %s", self.week_delta)
            input_date = datetime.now().date() + timedelta(weeks=self.week_delta)
        elif self.month_delta is not None:
            logger.debug("Calculating date using month_delta: %s", self.month_delta)
            input_date = datetime.now().date() + relativedelta(months=self.month_delta)
        elif self.year_delta is not None:
            logger.debug("Calculating date using year_delta: %s", self.year_delta)
            input_date = datetime.now().date() + relativedelta(years=self.year_delta)
        elif self.date:
            try:
                logger.debug("Parsing explicit date string: %s", self.date)
                input_date = datetime.strptime(self.date, "%d/%m/%Y").date()
            except ValueError as e:
                logger.exception("Failed to parse date: %s", self.date)
                return ToolOutput(
                    message_to_llm="INVALID DATE",
                    message_to_user=["Can you please provide a valid date."],
                    break_chat_agent_loop=True,
                )
        else:
            logger.error("No valid date parameter was provided.")
            return ToolOutput(
                message_to_llm="INVALID DATE",
                message_to_user=["Can you please provide a valid date."],
                break_chat_agent_loop=True,
            )
        today = datetime.now().date()
        cutoff_date = today + timedelta(days=2)

        if input_date < today:
            return ToolOutput(
                message_to_llm="DATE BEFORE TODAY",
                message_to_user=[f"Can you please provide a date after today's date"],
                break_chat_agent_loop=True,
            )

        input_date_to_user = input_date.strftime("%d/%m/%Y")
        context.parent_context.state_machine.update_agent_variable(
            "promised_to_pay_date", input_date_to_user
        )

        times_probed = int(
            context.parent_context.state_machine.get_agent_variables().get(
                "times_probed", "1"
            )
        )
        cutoff_date_retry = internal_variables.get("cutoff_date_retry", "1")
        max_cutoff_retry = 1 if times_probed >= 2 else 2

        if input_date > cutoff_date:
            if int(cutoff_date_retry) > max_cutoff_retry:
                context.parent_context.state_machine.update_internal_variable(
                    "cutoff_date_retry", "0"
                )
            else:
                cutoff_date_retry = int(cutoff_date_retry) + 1
                context.parent_context.state_machine.update_internal_variable(
                    "cutoff_date_retry", str(cutoff_date_retry)
                )
                days_due = (
                    context.parent_context.state_machine.get_agent_variables().get(
                        "days_due", ""
                    )
                )
                if cutoff_date_retry == 2:
                    return ToolOutput(
                        message_to_llm="increase count of number of times the user has been asked to pay today",
                        message_to_user=[
                            f"Thank you for letting us know. However your loan has already been due for {days_due} days. If you keep delaying the payment, late charge will be applied. Additionally, your CIBIL score will be impacted and you may face difficulty in availing future loans. Can you make the payment today?"
                        ],
                        break_chat_agent_loop=True,
                    )
                else:
                    return ToolOutput(
                        message_to_llm="increase count of number of times the user has been asked to pay today",
                        message_to_user=[
                            f"Your loan has already been overdue for {days_due} days. If you do not make the payment today, you will be facing penalty charges. Can you please make the payment today?"
                        ],
                        break_chat_agent_loop=True,
                    )
        context.parent_context.state_machine.update_agent_variable("disposition", "PTP")

        message_to_user = f"Thank you. We have noted your payment date as {input_date_to_user}. You would have received a secure payment link through which you can make the payment. We will hold all escalations till then. Please ensure the payment is made within the promised timeframe to avoid any further charges. Have a great day"

        end_conv_input = EndConversationInput(nudge_message=message_to_user)

        end_conv_tool = EndConversation()

        await end_conv_tool.run(context, end_conv_input)

        return ToolOutput(
            message_to_llm="VALID DATE",
            message_to_user=[message_to_user],
            break_chat_agent_loop=True,
        )

```

Key Features of Example Tools:

1. **Verify Last 4 Digits Tool**:
    - Validates user input against stored data
    - Provides clear success/failure messages
    - Uses agent variables for data storage (stored as strings)
2. **Calculate Tool**:
    - Supports multiple arithmetic operations
    - Includes error handling for division by zero
    - Provides formatted output messages
    - Handles invalid operations gracefully
    - Demonstrates proper string conversion for agent variables
    - Stores calculation results as strings in agent variables
3. **Date Validation Tool**:
    - Validates and processes user date inputs in various formats
    - Accepts specific dates (dd/mm/yyyy) or relative dates
    - Supports multiple input types:
        - Specific date string
        - Day of week (e.g., "Monday")
        - Days from today (e.g., tomorrow = 1)
        - Weeks from today (e.g., next week = 1)
        - Months from today
        - Years from today
    - Validates dates against business rules:
        - Rejects dates before today
        - Special handling for dates beyond cutoff (today + 2 days)
    - Updates agent variables with validated payment date
    - Includes formatting functions for dates and numbers
    - Controls conversation flow based on validation results
    - Focused on loan repayment contexts with payment date handling

This quick guide provides the essential information needed to create tools in the Sarvam framework.