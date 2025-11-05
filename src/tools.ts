import { tool } from '@langchain/core/tools';

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

