import { tool } from '@langchain/core/tools';
import { createRetrieverTool } from 'langchain/tools/retriever';
import { vectorStore } from '../indexDocs';

export const getOffers = tool(
    () => {
        //coders gyan platform(backend) -> api response -> get offers
        return JSON.stringify([
            {
                code: "LAUNCH",
                discount_percent: 30
            },
            {
                code: "FIRST_20",
                discount_percent: 20
            }
        ])
    },
    {
        name: "offers_query_tool",
        description: "Call this tool to get the available discounts and offers for courses."
    },
);

// Retrieval tool for fetching data from vector db
const retriever = vectorStore.asRetriever();

export const kbRetrieverTool = createRetrieverTool(retriever, {
    name: 'retrieve_learning_knowledge_base',
    description: 'Search and return information about syllabus, courses, FAQs, career doubts.',
});