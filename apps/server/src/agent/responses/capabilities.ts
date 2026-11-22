/**
 * The fixed answer sent whenever the classifier labels a message `capabilities` (#21). The main LLM is not
 * called for it. Same text for every provider; edit it here. Markdown is fine.
 */
export const CAPABILITIES_ANSWER = `I'm an **airport investment research assistant** for U.S. airports. I can help you:
- Look at **passenger traffic**: official FAA enplanement data for CY2015–CY2024, with year-over-year change and growth trends
- **Compare airports** and discuss which ones look like strong candidates for terminal expansion or modernization
- **Explain my reasoning** and state the assumptions and data limits behind an answer

Ask me something like *"How has BOS passenger traffic changed since 2019?"* or *"Compare LAX and SNA."*
I don't answer questions outside U.S. airports and aviation investment.`;
