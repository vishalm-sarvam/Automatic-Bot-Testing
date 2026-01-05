# Good Prompt Bad Prompt

<aside>
💡

As a bot builder it is your job to help the bot by giving easy to understand instructions so that the bot can help others ~ Tanay 

</aside>

### Key points

1. The hacks here should work well with 70b as well and is not limited to 7b
2. With 7b model we need to explicitly define what the bot needs to do. Dumping all the instructions won’t work like it does with a 70b model
3. Dumb down what the bot needs to do by specifying triggers for every instruction 
4. Specify all the things a bot needs to do in a single turn, in one instruction
5. Since this is a small model, it works best when the prompt size is small. Add more states if necessary. Do not put too many instructions in global prompt
    1. State instructions should be less than 500 tokens ideally
    2. To check number of tokens, go to  [Tokenizer Playground](https://huggingface.co/spaces/Xenova/the-tokenizer-playground), select custom model and put `Qwen/Qwen2.5-7B-Instruct` (for sarvam-beta) and select llama for sarvam-medium
6. Do not add random new lines

### Key components

1. We have 3 sections in the new prompt:
    1. Main steps → Define the full flow of the bot
    2. Alternative steps → Define any edge cases (Can be skipped)
    3. Guidelines → Place to specify Dos and Donts (Can be skipped)
    4. Do not change this naming convention. You can delete sections but don’t add or modify
2. Internally we have line numbering
    1. GI.x → global instructions
    2. SI.1.x → Main steps in state instructions  
    3. SI.2.x → Alternative steps in state instructions 
    4. SI.3.x → Guidelines in state instructions (2.x in case Alternative steps is missing)
    5. Every sub bullet point adds an extra `.x` in the line number
3. Instruction structure for individual functionalities
    1. Kb/Retrieval → If ….. then retrieve information from knowledge base and answer based on retrieved context
    2. End conversation → If …. end the conversation (do not write chat, call, etc.)
    3. State transition → If … transition to state: <state name>
    4. Variable updates → Update variable: <variable name> to <value> (Note: Make sure you define )
    5. Explicitly specifying what needs to be said → ….. say: “<text>”

## Examples of basic hacks

### **Example 1**

**Bad Prompt**

- Ask the user: "Am I speaking with at  {{customerName}}?"
- If the customer says yes, transition to state:state:verify_details
- If the customer says no: Tell the user: "I am calling from Tata capital and would like to speak with {{customerName}} regarding their {{loanType}}, do you know them?"
- If the says they are the customer's relative,  update variable: disposition to "relative" and ask for an alternate contact number.
- update variable: alternate_number with user's said value and politely end conversation.
- if they say they are no, update variable: disposition to "wrong_number" and politely end conversation apologizing for the confusion.

**Good Prompt**

##Main steps

- Ask the user: "Am I speaking with with {{customerName}}?"
    - If the user says yes, transition to state: VerifyDOB
    - If the user says no, Tell the user: "I am calling from Tata capital and would like to speak with {{customerName}} regarding their {{loanType}}, do you know them?"
    - If the user says they are the customer's relative,  update variable: disposition to "relative" and ask for an alternate contact number.
        - If they share the number, update variable: alternate_number with user's said value and politely end conversation.
    - If the user says neither they are {{customerName}}, nor do they know the person, update variable: disposition to "wrong_number" and politely end conversation apologizing for the confusion.

**Takeaways**

1. Every turn is a single instruction. 
2. All possibilities for a given instruction are specified as sub bullet points
3. Check for grammatical mistakes
4. Use the word user not customer and assistant not bot. LLMs only know the roles `user` , `assistant` , `tool` 

### **Example 2**

**Bad Prompt**

1. Ask the customer politely why they haven’t purchased the product and try to nudge them towards completing the purchase.
2. Use the knowledge base to tell them about potential benefits and offers that will persuade them to purchase the product.
3. Answer any questions the customer has using the knowledge base. If they ask a question out of context or if you are not able to answer any question, tell them that a human agent will call them shortly.
4. Update the variable: issue with “NA"
5. Ask if the customer has any questions.
6. If the customer does not have any further questions, politely end the call after saying - "Thank you for your time. Please continue to explore and shop on Tata Neu. Have a great day ahead!"

**Good Prompt**

## Main Steps

- Ask the user politely why they haven't purchased the product and try to nudge them towards completing the purchase.
- Retrieve information from the knowledge base and tell them about potential benefits and offers that will persuade them to purchase the product based on the retrieved context.
- Ask if the user has any further questions.
    - If the user does not have any further questions, politely end the conversation after saying - \"Thank you for your time. Please continue to explore and shop on Tata Neu. Have a great day ahead!\"
    - If the user has any further questions, retrieve information from the knowledge base and answer based on retrieved context.

## Alternative Steps

- If they ask a question out of context or if you are not able to answer any question, tell them that a human agent will call them shortly.

**Takeaways**

1. Instructions need not be a flow always. Unrelated instructions can be present in the instructions and should be added as main bullet points
2. Repeat some instructions if necessary
3. Use of the term “user” instead of “customer”
4. Multiple instructions corresponding to multiple turns are not clubbed together

### Example 3

**Bad Prompt**

- If the user says yes then go ahead and continue the survey; however, if the user say no they don't have time or if they are busy tell them that a representative will call them back after a while and end the call
- Then ask the user "What is your name?".  Once the user answers then.
- Ask them the name of their village.Once the user answers then.
- Ask them what is the name of their Mandal. Once the user answers then.
- Ask them what is the name of their District. Once the user answers then.
- Then ask them if they grow chillis (yes or no). Once the user answers then.
- If they grow chilli ask them on how many acres do they grow chilli. Once the user answers then.
- Then ask them if they have used Godrej Gracia in chilli before? Once the user answers then.
- Thank them for their time and end_conversation
- If they say no to growing chilis; say "thank you for your time" and end the call  don't say anything extra; if they say yes, continue the survey
- Don't repeat the responses that the user gives, don't address the user by their name continuously
- Always wait for an answer before going to the next question.

**Good Prompt**

##Main steps

- Ask the user if it is a good time to do the survey
    - If user says no they don't have time or if they are busy tell them that a representative will call them back after a while and end the conversation
- If the user says yes, say: "What is your name?"
- Ask them the name of their village.
- Say: “What is the name of your Mandal?”
- Ask them the name of their District
- Ask them if they grow chillis
    - If they say no to growing chilis; say "thank you for your time" and end the conversation
    - If user says they grow chilli ask them on how many acres do they grow chilli.
        - Then ask them if they have used Godrej Gracia in chilli before?
- Thank the user for their time and end the conversation.

##Guidelines

- Don't repeat the responses that the user gives and don't address the user by their name continuously
- Always wait for an answer before going to the next question.

**Takeaways**

1. Use `conversation` instead of `call`
2. For terms that might be confusing for the model, write the exact statement to say else model might get confused and add some additional things 
3. If you want to add phrases like “Once the user answers then”, add them at the beginning of the instruction not at the end of previous instruction. Because if model is executing an instruction which has a then at the end, it would assume there is more to it and execute the next instruction also. Every instruction should have a defined start and end
4. Sometimes sub bullet points can just be sequential steps to be followed if a specific condition is specified. They need not be alternatives always.  

### Example 4

**Bad Prompt**

- Before asking for EMI, if the current value of num_valid_details (current value: 2) >= 1, update variable verified:"True" and transition to state: GeneralConversation
- Ask the user for their EMI amount.
- If user provides the EMI amount call tool:confirm_information with specified details
- If information matches, and current value of num_valid_details is greater than or equal to 1, transition to state: GeneralConversation. If it is 0, inform the user that their details could not be verified and end the conversation
- If information doesn't match, inform the user that the information could not be verified and end the conversation.

**Good Prompt**

##Main steps

{% if num_valid_details == "2"%}

- Update variable: verified to "True" and transition to state: GeneralConversation

{% else %}

- Ask the user for their EMI amount.
    - If user provides the EMI amount call tool: confirm_information ,specifying information type as "information_type":"EMI_Amount"  and value as what the user said, to confirm the information provided by the user.
        - If the tool result says <information> matches, and current value of num_valid_details ({{num_valid_details}}) is greater than or equal to 1, transition to state: GeneralConversation
        - If the tool result says <information> matches, and current value of num_valid_details (current value: {{num_valid_details}}) is 0, inform the user that their details could not be verified and end the conversation.
        - If the tool result says <information> doesn't match, and current value of num_valid_details (current value: {{num_valid_details}}) is 2, transition to state: GeneralConversation
        - If the tool result says <information> doesn't match, inform the user that the information could not be verified and end the conversation.
    - If user denies to provide the asked information, thank the user and end the conversation.

##Alternative Steps

- If user says they don't want to proceed, thank the user and end the conversation

##Guidelines

- Do not call tool: confirm_information unless the user specifies their emi amount. Specify the emi amount mentioned by the user while calling the tool
- Do not update the variable num_valid_details unless information is verified successfully.

{% endif %}

**Takeaways**

1. Use of variables to guide the conversation. You can define variables which can potentially help guide the conversation flow. Then use if conditions of jinja to show only relevant parts to the model
2. Explicitly write triggers for executing instructions
3. For instructions which are dependent on tool results, write `if tool result says` or some variation of this
4. If bot has some unexpected behaviour, write a guideline to make sure bot doesn’t do it. (Might not work very reliably but we’ll make sure it works well in future iterations)
5. Reference variables in place so that model has all the information in the instruction itself to make a decision

### Example 5

**Bad Prompt**

1. Ask the user to state the product, size and quantity they would like to order. Do not give any examples of the format.
2. If the user mentions the product but does not specify the size, ask them to specify the size. (For example, if the user says they want 2 units of Fevicol DDL, ask them in which packaging they would like - 1kg, 500gm, or 125gm). In case the user has given multiple items in the same order, check that the size is mentioned for all the mentioned items.
3. In case the product has multiple variants and the user has not mentioned those, ask the user to specify the variant. (For example, if the user wants 3 units of Unitint, ask them which variant - fast red, fast green or fast yellow). In case the user has given multiple items in the same order, check if the variant is required for all the mentioned items. If you see a product that the customer has ordered which has multiple variants, but the order does not specify the variant, ask the customer before proceeding to add.
4. If the user gives you all the information about the product but does not specify the quantity, ask them "How many units would you like to order for (product)?".
5. Check to see if the ordered product, size or variant is in the product sheet. If not, tell the customer that you are not able to find that product. Ask them to repeat it or order a different product. If applicable, tell them the available size or variants for the product. In case the user orders multiple products at once, check this for all the products. Do not add to cart unless you find the product in the sheet. Do not create product / variants / sizes on your own.
6. Based on their response, update the variables: {mother code}. Ensure you know the product name, variant and size before adding. The user might ask to add multiple items at once in a single message, so update the quantity variables for all the items.
7. Tell the user what changes you are making to the cart whenever they add products to the cart. For example, "I have added 2 units of Fevicol DLL 1kg and 3 units of Unitint Fast Red 100ml to your cart."
8. Ask the customer if they have any more requirements. If they say yes, repeat this state. Else, transition to STATE: ConfirmingOrder

**Good Prompt**

**Takeaways**

1. If there are too many instructions, split it into multiple states
2. Use good tools to handle complicated usecases. Do the hard things inside the tool (can use LLMs inside tool) and let conversation model just do the job of following instructions. The model will not do reasoning or math for you!

## Instructions already present in prompt template

Additional guidelines already present in template which you need not specify again in instructions (unless it doesn't work)

### sarvam-medium

- Use direct speech.
- Only acknowledge when necessary.
- Keep responses very short and concise.
- When user shares important information, confirm your understanding.
- Do not share personal opinion like "very good to hear that" or "I am happy to hear that" etc.
- Always maintain a warm, friendly tone.
- Briefly acknowledge off-topic questions only if not disruptive, otherwise gently nudge users back to the topic of discussion.
- Generate statements that are really simple and can be easily translated to Indic languages.
- When generating quantitative values such as currency, quantities, etc. ensure to format the number with commas. For example, 10000 kg should be formatted as 10,000 kg. NOTE: Leave numeric ids such as phone numbers, transaction ids, etc. unformatted.

### sarvam-beta

AG.1 Use direct speech unless specified otherwise in the instructions.
AG.2 Only acknowledge when necessary. Do not overuse.
AG.3 When user shares important information, confirm your understanding.
AG.4 Do not share personal opinion like "very good to hear that" or "I am happy to hear that" etc.

AG.5 Express empathy for negative emotions or challenging situations. For example: I understand.
AG.6 For toxic responses, respond with empathy and redirect. For example: Sorry but let us get back to <topic>
AG.7 Generate statements that are really simple and can be easily translated to Indic languages.
AG.8 Avoid western linguistic structures. Express each sentence's core meaning in fewest words. Favor direct speech.
AG.9 Keep responses very short and concise unless specified otherwise in the instructions. Aim for responses which are under 15 words long
AG.10 If the user asks an off topic question, gently nudge them back to the topic of discussion. Example: I understand, but can we talk about [original topic]?
AG.11 Ask for clarification when user's statement is ambiguous. Example response: Could you clarify this a bit more?
AG.12 This is a voice based interaction. Do not use text chat references like "you can type 'yes' to continue". Instead, use voice based instructions like "say 'yes' to continue".
AG.13 Your response must be a single, valid JSON object with no additional text or messages outside of it.
AG.14 Ensure that your JSON output is syntactically correct and can be parsed by standard JSON parsers.
AG.15 When generating quantitative values such as currency, quantities, etc. ensure to format the number with commas. For example, 10000 kg should be formatted as 10,000 kg. NOTE: Leave numeric ids such as phone numbers, transaction ids, etc. unformatted.