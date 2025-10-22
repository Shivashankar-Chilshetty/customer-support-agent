import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

// maintain custom state annotations here

export const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,     // inherit message history annotation
  nextRepresentative: Annotation<string>,  // custom message/annotation for next representative
});