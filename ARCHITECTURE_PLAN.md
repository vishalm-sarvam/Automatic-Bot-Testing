# Automated Bot Testing Application - Architecture Plan

## Executive Summary

This document outlines the architecture for an automated testing system for Sarvam Agents Platform conversational AI bots. The system will:
1. Parse state graphs from bot configurations
2. Generate comprehensive test scenarios
3. Convert scenarios to speech and interact with bots via voice
4. Detect translation/transliteration issues
5. Auto-suggest prompt modifications

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTOMATED BOT TESTING SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  Configuration  │───▶│ Scenario         │───▶│  Test Execution      │   │
│  │  Ingestion      │    │ Generator        │    │  Engine              │   │
│  └─────────────────┘    └──────────────────┘    └──────────────────────┘   │
│          │                      │                        │                  │
│          ▼                      ▼                        ▼                  │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  State Graph    │    │  Scenario        │    │  Voice Interaction   │   │
│  │  Parser         │    │  Repository      │    │  Module              │   │
│  └─────────────────┘    └──────────────────┘    └──────────────────────┘   │
│                                                          │                  │
│                                                          ▼                  │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  Prompt         │◀───│ Analysis &       │◀───│  Response Capture    │   │
│  │  Modifier       │    │ Issue Detection  │    │  & Transcription     │   │
│  └─────────────────┘    └──────────────────┘    └──────────────────────┘   │
│          │                                                                  │
│          ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Reporting & Dashboard                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Options

### Option A: Full Voice-to-Voice Testing (Recommended)

**Description**: Simulates real user calls by converting test scenarios to speech, calling the bot via the Outbound API, and analyzing recorded responses.

```
Test Scenario → TTS → Audio File → Outbound API Call → Bot Response → STT → Analysis
```

**Pros**:
- Tests the complete pipeline (ASR + LLM + TTS)
- Catches real translation/transliteration issues
- Tests actual voice quality and timing

**Cons**:
- Slower execution
- Requires phone numbers for testing
- More API calls = higher cost

**Components**:
1. TTS Service (Sarvam TTS or external)
2. Telephony Integration (Outbound API)
3. Recording Capture (Analytics API)
4. STT for Response Analysis

---

### Option B: Text-Based Simulation with Voice Validation

**Description**: Run most tests in text mode for speed, with selective voice tests for critical paths.

```
Test Scenario (Text) → WebSocket/API → Bot Response (Text) → Analysis
                     ↓ (Selected Scenarios)
              TTS → Voice Test → STT → Compare with Text Response
```

**Pros**:
- Much faster execution
- Lower cost
- Can run thousands of tests quickly

**Cons**:
- May miss voice-specific issues
- Requires WebSocket/text API (need to verify availability)

---

### Option C: Hybrid Approach (Recommended for Production)

**Description**: Combine text-based rapid testing with voice validation for critical scenarios.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST EXECUTION MODES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FAST MODE (Text)                 VOICE MODE                    │
│  ├── Unit Tests                   ├── Critical Path Tests       │
│  ├── State Transition Tests       ├── Translation Validation    │
│  ├── Tool Response Tests          ├── Transliteration Tests     │
│  └── Edge Case Coverage           └── End-to-End Flows          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Design

### 1. Configuration Ingestion Module

**Purpose**: Fetch and parse bot configurations from the Agents Platform.

**API Endpoint**:
```
GET https://apps.sarvam.ai/api/app-authoring/orgs/{org_id}/workspaces/{workspace_id}/apps/{app_id}?app_version={version}
```

**Data Extracted**:
- State Graph (states, transitions, tools)
- Agent Variables
- Global Prompt
- State-specific Instructions
- Supported Languages
- TTS/STT Configuration

**Implementation**:
```python
class BotConfigurationLoader:
    def __init__(self, api_key: str, org_id: str, workspace_id: str):
        self.base_url = "https://apps.sarvam.ai/api/app-authoring"
        self.headers = {"X-API-Key": api_key}

    async def fetch_bot_config(self, app_id: str, version: int) -> BotConfiguration:
        """Fetch complete bot configuration from API"""
        pass

    def parse_state_graph(self, config: dict) -> StateGraph:
        """Extract state machine from configuration"""
        pass

    def extract_variables(self, config: dict) -> dict[str, Variable]:
        """Extract agent variables with metadata"""
        pass
```

---

### 2. State Graph Parser

**Purpose**: Convert bot configuration into a traversable graph structure.

**Graph Structure**:
```python
@dataclass
class State:
    name: str
    instructions: str
    tools: list[str]
    next_states: list[str]
    variables_in_context: list[str]

@dataclass
class StateGraph:
    states: dict[str, State]
    initial_state: str

    def get_all_paths(self, max_depth: int = 10) -> list[list[str]]:
        """Generate all possible state traversal paths"""
        pass

    def get_critical_paths(self) -> list[list[str]]:
        """Identify most common/important user journeys"""
        pass
```

**Example Graph from Restaurant Bot**:
```
Greetings
├── Check_Availability → Collect_Details → Confirm_Booking → End_Conversation
│                                      └── Cancel_Reservation → End_Conversation
└── Lookup_Reservation
    ├── Modify_Reservation → End_Conversation
    ├── View_Reservation → End_Conversation
    └── Cancel_Reservation → End_Conversation
```

---

### 3. Scenario Generator

**Purpose**: Automatically generate test scenarios from state graph and instructions.

**Scenario Types**:

| Type | Description | Priority |
|------|-------------|----------|
| Happy Path | Standard successful flows | High |
| Edge Cases | Boundary conditions | High |
| Error Handling | Invalid inputs, timeouts | Medium |
| Language Variations | Multi-language support | High |
| Tool Failures | Simulated tool errors | Medium |
| State Transitions | All possible transitions | High |

**Generation Strategy**:

```python
class ScenarioGenerator:
    def __init__(self, state_graph: StateGraph, llm_client: LLMClient):
        self.graph = state_graph
        self.llm = llm_client

    async def generate_scenarios(self) -> list[TestScenario]:
        scenarios = []

        # 1. Path-based scenarios
        for path in self.graph.get_all_paths():
            scenarios.extend(await self._generate_path_scenarios(path))

        # 2. Instruction-based scenarios (use LLM to understand instructions)
        for state in self.graph.states.values():
            scenarios.extend(await self._generate_instruction_scenarios(state))

        # 3. Edge case scenarios
        scenarios.extend(await self._generate_edge_cases())

        # 4. Language variation scenarios
        scenarios.extend(await self._generate_language_scenarios())

        return scenarios

    async def _generate_path_scenarios(self, path: list[str]) -> list[TestScenario]:
        """Generate conversation flows for a given state path"""
        prompt = f"""
        Given this conversation flow: {' → '.join(path)}

        Generate realistic user utterances that would trigger this flow.
        Consider the bot instructions for each state.

        Output format:
        - Turn 1 (User): <utterance>
        - Expected State: <state_name>
        - Turn 2 (User): <utterance>
        ...
        """
        # Use LLM to generate natural conversations
        pass
```

**Scenario Template**:
```python
@dataclass
class TestScenario:
    id: str
    name: str
    description: str
    language: str
    turns: list[ConversationTurn]
    expected_states: list[str]
    expected_variables: dict[str, str]
    expected_tool_calls: list[str]
    tags: list[str]  # e.g., ["happy_path", "booking", "tamil"]

@dataclass
class ConversationTurn:
    speaker: Literal["user", "bot"]
    text: str
    expected_intent: Optional[str]
    expected_entities: Optional[dict]
    audio_file: Optional[str]  # For voice tests
```

---

### 4. Voice Interaction Module

**Purpose**: Convert scenarios to speech and interact with the bot.

**Sub-components**:

#### 4.1 Text-to-Speech Converter
```python
class TTSConverter:
    """Convert test scenarios to audio files"""

    async def convert_to_speech(
        self,
        text: str,
        language: str,
        voice_settings: dict
    ) -> bytes:
        """
        Use Sarvam TTS API to convert text to speech.

        POST https://api.sarvam.ai/tts
        {
            "text": "வணக்கம்",
            "language": "ta-IN",
            "speaker": "neha"
        }
        """
        pass
```

#### 4.2 Outbound Call Initiator
```python
class OutboundCallManager:
    """Manage outbound calls to test the bot"""

    async def initiate_test_call(
        self,
        test_phone: str,
        app_id: str,
        initial_variables: dict
    ) -> str:  # Returns attempt_id
        """
        POST https://apps.sarvam.ai/api/outbounds/v1/orgs/{org}/workspaces/{ws}/outbounds
        {
            "app_config": {
                "app_id": "Restaurant--2346c23a-3842",
                "connection_id": "...",
                "agent_variables": {...}
            },
            "user_config": {
                "phone_number": "+91XXXXXXXXXX"
            },
            "webhook_config": {
                "url": "https://my-server/webhook"
            }
        }
        """
        pass
```

#### 4.3 Response Recorder
```python
class ResponseRecorder:
    """Capture and process bot responses"""

    async def get_recording(self, attempt_id: str) -> AudioRecording:
        """Fetch call recording from Analytics API"""
        pass

    async def get_transcript(self, attempt_id: str) -> Transcript:
        """Fetch call transcript from Analytics API"""
        pass
```

---

### 5. Analysis & Issue Detection Module

**Purpose**: Analyze bot responses and detect issues.

**Issue Categories**:

| Category | Description | Detection Method |
|----------|-------------|------------------|
| Translation Error | Incorrect translation | Compare expected vs actual |
| Transliteration Error | Wrong script/pronunciation | Pattern matching + phonetic analysis |
| State Transition Bug | Wrong state reached | Compare with expected path |
| Tool Call Error | Missing/wrong tool call | Log analysis |
| Response Quality | Unnatural/incomplete response | LLM evaluation |
| Latency Issue | Slow response time | Timing measurement |

**Implementation**:
```python
class IssueDetector:
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def analyze_conversation(
        self,
        scenario: TestScenario,
        actual_responses: list[BotResponse],
        transcript: Transcript
    ) -> list[Issue]:
        issues = []

        # 1. State transition validation
        issues.extend(self._check_state_transitions(scenario, actual_responses))

        # 2. Translation quality check
        issues.extend(await self._check_translation(scenario, actual_responses))

        # 3. Transliteration check
        issues.extend(self._check_transliteration(transcript))

        # 4. Tool call verification
        issues.extend(self._check_tool_calls(scenario, actual_responses))

        # 5. Response quality assessment
        issues.extend(await self._assess_response_quality(scenario, actual_responses))

        return issues

    async def _check_translation(
        self,
        scenario: TestScenario,
        responses: list[BotResponse]
    ) -> list[Issue]:
        """
        Use LLM to evaluate translation quality:
        - Semantic accuracy
        - Cultural appropriateness
        - Grammar correctness
        - Natural flow
        """
        prompt = f"""
        Evaluate the translation quality:

        Source Language: English
        Target Language: {scenario.language}

        Expected meaning: {scenario.expected_response}
        Actual response: {responses[-1].text}

        Rate on:
        1. Semantic accuracy (1-5)
        2. Grammar correctness (1-5)
        3. Naturalness (1-5)

        Identify any specific errors.
        """
        pass

    def _check_transliteration(self, transcript: Transcript) -> list[Issue]:
        """
        Check for common transliteration errors:
        - Incorrect phoneme mapping
        - Script mixing errors
        - Number pronunciation issues
        """
        # Common patterns to check
        patterns = {
            "tamil": {
                "numbers": r"[0-9]+",  # Should be spoken in Tamil
                "english_words": r"[a-zA-Z]+",  # Check if code-mixed
            }
        }
        pass

@dataclass
class Issue:
    id: str
    severity: Literal["critical", "high", "medium", "low"]
    category: str
    description: str
    scenario_id: str
    turn_number: int
    expected: str
    actual: str
    suggested_fix: Optional[str]
    state_name: Optional[str]
```

---

### 6. Prompt Modifier Module

**Purpose**: Suggest and optionally apply prompt modifications based on detected issues.

**Modification Types**:
- Instruction clarification
- Variable usage fixes
- State transition corrections
- Language-specific adjustments

```python
class PromptModifier:
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def suggest_modifications(
        self,
        issues: list[Issue],
        current_config: BotConfiguration
    ) -> list[PromptModification]:
        """
        Generate prompt modification suggestions based on detected issues.
        """
        modifications = []

        for issue in issues:
            if issue.category == "translation_error":
                mod = await self._suggest_translation_fix(issue, current_config)
            elif issue.category == "state_transition_bug":
                mod = await self._suggest_state_fix(issue, current_config)
            elif issue.category == "tool_call_error":
                mod = await self._suggest_tool_fix(issue, current_config)

            if mod:
                modifications.append(mod)

        return modifications

    async def _suggest_translation_fix(
        self,
        issue: Issue,
        config: BotConfiguration
    ) -> PromptModification:
        """
        Use LLM to suggest prompt changes that would fix translation issues.
        """
        state = config.states[issue.state_name]

        prompt = f"""
        The following bot instruction is causing translation issues in {issue.category}:

        Current Instruction:
        {state.instructions}

        Issue:
        {issue.description}

        Expected behavior: {issue.expected}
        Actual behavior: {issue.actual}

        Suggest a modified instruction that would:
        1. Fix the translation issue
        2. Follow Sarvam prompt best practices
        3. Be under 500 tokens
        4. Use explicit triggers

        Output the modified instruction only.
        """
        pass

@dataclass
class PromptModification:
    state_name: str
    field: str  # "instructions", "global_prompt", etc.
    original_value: str
    suggested_value: str
    reason: str
    confidence: float
    related_issues: list[str]
```

---

### 7. Test Orchestrator

**Purpose**: Coordinate all components and manage test execution.

```python
class TestOrchestrator:
    def __init__(
        self,
        config_loader: BotConfigurationLoader,
        scenario_generator: ScenarioGenerator,
        voice_module: VoiceInteractionModule,
        analyzer: IssueDetector,
        modifier: PromptModifier
    ):
        self.config_loader = config_loader
        self.scenario_generator = scenario_generator
        self.voice_module = voice_module
        self.analyzer = analyzer
        self.modifier = modifier

    async def run_test_suite(
        self,
        app_id: str,
        test_config: TestConfig
    ) -> TestReport:
        """
        Main entry point for running automated tests.
        """
        # 1. Load bot configuration
        bot_config = await self.config_loader.fetch_bot_config(app_id)

        # 2. Generate test scenarios
        scenarios = await self.scenario_generator.generate_scenarios()

        # 3. Execute tests
        results = []
        for scenario in scenarios:
            if test_config.mode == "voice":
                result = await self._execute_voice_test(scenario)
            else:
                result = await self._execute_text_test(scenario)
            results.append(result)

        # 4. Analyze results and detect issues
        all_issues = []
        for result in results:
            issues = await self.analyzer.analyze_conversation(
                result.scenario,
                result.responses,
                result.transcript
            )
            all_issues.extend(issues)

        # 5. Generate modification suggestions
        modifications = await self.modifier.suggest_modifications(
            all_issues,
            bot_config
        )

        # 6. Generate report
        return TestReport(
            bot_config=bot_config,
            scenarios_run=len(scenarios),
            results=results,
            issues=all_issues,
            suggested_modifications=modifications
        )
```

---

## Data Models

### Test Configuration
```python
@dataclass
class TestConfig:
    mode: Literal["text", "voice", "hybrid"]
    languages: list[str]
    test_phone_numbers: list[str]
    max_scenarios: int
    parallel_tests: int
    timeout_seconds: int
    voice_settings: VoiceSettings

@dataclass
class VoiceSettings:
    tts_provider: str
    speaker_id: str
    pace: float
    pitch: float
```

### Test Results
```python
@dataclass
class TestResult:
    scenario: TestScenario
    status: Literal["passed", "failed", "error"]
    responses: list[BotResponse]
    transcript: Optional[Transcript]
    duration_seconds: float
    states_visited: list[str]
    tools_called: list[str]
    issues: list[Issue]

@dataclass
class TestReport:
    timestamp: datetime
    bot_config: BotConfiguration
    scenarios_run: int
    passed: int
    failed: int
    results: list[TestResult]
    issues: list[Issue]
    suggested_modifications: list[PromptModification]

    def generate_summary(self) -> str:
        """Generate human-readable summary"""
        pass

    def export_json(self) -> dict:
        """Export full report as JSON"""
        pass

    def export_markdown(self) -> str:
        """Export as markdown report"""
        pass
```

---

## API Integration Points

### Sarvam Platform APIs

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `/api/app-authoring/orgs/{org}/workspaces/{ws}/apps/{app}` | Fetch bot config | GET |
| `/api/outbounds/v1/orgs/{org}/workspaces/{ws}/outbounds` | Initiate test call | POST |
| `/api/analytics/attempts` | Get test attempts | GET |
| `/api/analytics/transcripts/{attempt_id}` | Get transcript | GET |
| `/api/analytics/recordings/{attempt_id}` | Get recording | GET |

### External APIs (Optional)

| Service | Purpose |
|---------|---------|
| Sarvam TTS | Text-to-Speech conversion |
| Sarvam STT | Speech-to-Text for analysis |
| OpenAI/Claude | Scenario generation, quality analysis |

---

## Technology Stack Recommendation

### Core Framework
- **Language**: Python 3.11+
- **Async Framework**: asyncio + aiohttp
- **Data Validation**: Pydantic v2

### Key Libraries
```
# requirements.txt
aiohttp>=3.9.0          # Async HTTP client
pydantic>=2.0.0         # Data validation
networkx>=3.0           # Graph operations
jinja2>=3.1.0           # Template rendering
rich>=13.0.0            # CLI output
pytest>=7.0.0           # Testing
pytest-asyncio>=0.21.0  # Async tests
httpx>=0.25.0           # HTTP client
```

### Optional Services
- **Redis**: Scenario caching, rate limiting
- **PostgreSQL**: Test history storage
- **Grafana**: Real-time monitoring dashboard

---

## Project Structure

```
automated-bot-testing/
├── src/
│   ├── __init__.py
│   ├── config/
│   │   ├── __init__.py
│   │   ├── loader.py           # Bot configuration loader
│   │   └── models.py           # Configuration data models
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── parser.py           # State graph parser
│   │   └── traversal.py        # Path generation
│   ├── scenarios/
│   │   ├── __init__.py
│   │   ├── generator.py        # Scenario generator
│   │   ├── models.py           # Scenario data models
│   │   └── templates/          # Scenario templates
│   ├── voice/
│   │   ├── __init__.py
│   │   ├── tts.py              # Text-to-speech
│   │   ├── stt.py              # Speech-to-text
│   │   └── telephony.py        # Outbound call management
│   ├── analysis/
│   │   ├── __init__.py
│   │   ├── detector.py         # Issue detection
│   │   ├── translation.py      # Translation quality
│   │   └── models.py           # Issue data models
│   ├── modifier/
│   │   ├── __init__.py
│   │   ├── suggester.py        # Modification suggestions
│   │   └── applier.py          # Apply modifications
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   └── runner.py           # Test orchestration
│   └── reporting/
│       ├── __init__.py
│       ├── generator.py        # Report generation
│       └── templates/          # Report templates
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── scripts/
│   ├── run_tests.py
│   └── generate_scenarios.py
├── config/
│   ├── settings.yaml
│   └── logging.yaml
├── docs/
│   ├── architecture.md
│   └── api.md
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Setup project structure
- [ ] Implement configuration loader
- [ ] Build state graph parser
- [ ] Create basic data models

### Phase 2: Scenario Generation (Week 2-3)
- [ ] Path-based scenario generator
- [ ] LLM-powered conversation generator
- [ ] Multi-language scenario support
- [ ] Edge case templates

### Phase 3: Test Execution (Week 3-4)
- [ ] Text-based test runner
- [ ] TTS integration
- [ ] Outbound call integration
- [ ] Response capture

### Phase 4: Analysis (Week 4-5)
- [ ] Issue detection logic
- [ ] Translation quality checker
- [ ] Transliteration validator
- [ ] Tool call verifier

### Phase 5: Modification & Reporting (Week 5-6)
- [ ] Prompt modification suggester
- [ ] Report generator
- [ ] Dashboard (optional)
- [ ] CI/CD integration

---

## Next Steps

1. **Validate API Access**: Confirm availability of all required Sarvam Platform APIs
2. **Choose Architecture**: Select between Option A, B, or C based on constraints
3. **Setup Development Environment**: Initialize project with dependencies
4. **Implement Phase 1**: Start with configuration loader and graph parser
5. **Define Test Scenarios**: Create initial scenario templates for the restaurant bot

---

## Questions to Resolve

1. **API Access**:
   - Is there a text-based API for testing bots (WebSocket/REST)?
   - What's the rate limit for outbound calls?
   - Can we access call recordings programmatically?

2. **Authentication**:
   - How do we obtain API keys?
   - Are there separate keys for different environments?

3. **Testing Infrastructure**:
   - Do we have dedicated test phone numbers?
   - Is there a sandbox environment?

4. **Scope**:
   - Should we support multiple bots or focus on one initially?
   - Priority of language support (Tamil first, then others?)
