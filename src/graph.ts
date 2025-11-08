import { END, StateGraph } from "@langchain/langgraph";
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { StateAnnotation } from "./state";
import { model } from "./model";
import { getOffers } from "./tools";
import type { AIMessage } from '@langchain/core/messages';


const marketingTools = [getOffers];
const marketingToolNode = new ToolNode(marketingTools);

async function frontDeskSupport(state: typeof StateAnnotation.State) {
    const SYSTEM_PROMPT = `You are frontline support staff for Namaste-DEV, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
        Be concise in your responses.
        You can chat with students and help them with basic questions, but if the student is having a marketing or learning support query,
        do not try to answer the question directly or gather information.
        Instead, immediately transfer them to the marketing team(promo codes, discounts, offers, and special campaigns) or learning support team(courses, syllabus coverage, learning paths, and study strategies) by asking the user to hold for a moment.
        Otherwise, just respond conversationally.`;

    const supportResponse = await model.invoke([
        { role: "system", content: SYSTEM_PROMPT },
        ...state.messages   //user and agent messages
    ])

    const CATEGORIZATION_SYSTEM_PROMPT = `You are an expert customer support routing system.
        Your job is to detect whether a customer support representative is routing a user to a marketing team or learning support team, or if they are just responding conversationally.`;

    const CATEGORIZATION_HUMAN_PROMPT = `The previous conversation is an interaction between a customer support representative and a user.
        Extract whether the representative is routing the user to a marketing team or learning support team, or whether they are just responding conversationally.
        Respond with a JSON object containing a single key called "nextRepresentative" with one of the following values:

        If they want to route the user to the marketing team, respond with "MARKETING".
        If they want to route the user to the learning support team, respond with "LEARNING".
        Otherwise, respond only with the word "RESPOND".`;

    const categorizationResponse = await model.invoke(
        [
            {
                role: 'system',
                content: CATEGORIZATION_SYSTEM_PROMPT,
            },
            ...state.messages,
            supportResponse,
            {
                role: 'user',
                content: CATEGORIZATION_HUMAN_PROMPT,
            },
        ],
        {
            response_format: {
                type: 'json_object',
            },
        }
    );
    const categorizationOutput = JSON.parse(categorizationResponse.content as string);

    return {
        messages: [supportResponse],
        nextRepresentative: categorizationOutput.nextRepresentative,
    };
}

async function marketingSupport(state: typeof StateAnnotation.State) {
    //logic for marketing support
    //bind marketing tools to the generic model
    const llmWithTools = model.bindTools(marketingTools);

    const SYSTEM_PROMPT = `You are part of the Marketing Team at Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
        You specialize in handling questions about promo codes, discounts, offers, and special campaigns.
        Answer clearly, concisely, and in a friendly manner. For queries outside promotions (course content, learning), politely redirect the student to the correct team.
        Important: Answer only using given context, else say I don't have enough information about it.`;
    console.log('Handling by marketing team...')

    let trimmedHistory = state.messages; // Get all the message history from state
    // If last message is from AI, remove it, i,e when the user asks "Are there any discounts on the course?"
    //→ this will be message 1, agent responds → "Wait i will redirect you to marketing agent", this is message 2, 
    //so here we can directly send the user message 1 to the marketing support agent/LLM & trim/remove the message 2. 
    if (trimmedHistory.at(-1)?.getType() === 'ai') {
        trimmedHistory = trimmedHistory.slice(0, -1); // [1, 2, 3] -> [1, 2]
    }


    const marketingResponse = await llmWithTools.invoke([
        {
            role: "system", content: SYSTEM_PROMPT
        },
        ...trimmedHistory   //user and agent messages
    ]);

    return {
        messages: [marketingResponse]
    }
}

function learningSupport(state: typeof StateAnnotation.State) {
    //logic for learning support
    console.log('Handling by learning support team...')
    return state;
}

function whoIsNextRepresentative(state: typeof StateAnnotation.State) {
    if (state.nextRepresentative.includes('MARKETING')) {
        return 'marketingSupport';
    } else if (state.nextRepresentative.includes('LEARNING')) {
        return 'learningSupport';
    } else if (state.nextRepresentative.includes('RESPOND')) {
        return '__end__';
    } else {
        return '__end__';
    }
}

//check if last message has tool calls(i,e check if ai used a tool), if yes then call that tool node
function isMarketingTool(state: typeof StateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    if (lastMessage.tool_calls?.length) {
        return 'marketingTools';
    }

    return '__end__';
}

const graph = new StateGraph(StateAnnotation)
    .addNode('frontDeskSupport', frontDeskSupport)
    .addNode('marketingSupport', marketingSupport)
    .addNode('learningSupport', learningSupport)
    .addNode('marketingTools', marketingToolNode)
    .addEdge('__start__', 'frontDeskSupport')
    .addEdge('marketingTools', 'marketingSupport')
    //.addEdge('learningSupport', 'learningSupport')
    .addConditionalEdges('frontDeskSupport', whoIsNextRepresentative, {
        marketingSupport: 'marketingSupport',
        learningSupport: 'learningSupport',
        __end__: '__end__',
    })
    .addConditionalEdges('marketingSupport', isMarketingTool, {
        marketingTools: 'marketingTools',
        __end__: END,
    })


const app = graph.compile();

//invoke graph
async function main() {
    const stream = await app.stream({
        messages: [
            { role: "user", content: "can i get any discount code?" }
        ]
    });
    for await (const value of stream) {
        console.log('---STEP---');
        console.log(value);
        console.log('---STEP---');

    }
}

main();