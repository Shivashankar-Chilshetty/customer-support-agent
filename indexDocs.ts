import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
});

const pinecone = new PineconeClient();

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error("PINECONE_INDEX_NAME environment variable is not set.");
}
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

export const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

export async function indexTheDocument(filePath: string) {
  // Load the document
  const loader = new PDFLoader(filePath, { splitPages: false });
  //docs will be an array of documents(pages)
  const doc = await loader.load();  //contains array of pages having Document { pageContent: string; metadata: any;}

  const textSplitter = new CharacterTextSplitter({
    chunkSize: 500, //size of chunk
    chunkOverlap: 100, // overlap atmost 100 characters between each chunks
  });
  if (!doc[0]) {
    throw new Error("Document is empty or undefined.");
  }
  const texts = await textSplitter.splitText(doc[0].pageContent);

  const documents = texts.map((chunk) => {
    return {
      pageContent: chunk,
      metadata: doc[0]?.metadata || {}
    }
  })

  //console.log(documents); //array of documents with chunked pageContent & metadata
  //chunked data will now gets embedded and stored in vector db
  await vectorStore.addDocuments(documents);
}

//indexTheDocument("./cg-knowledge-base.pdf")

console.log('Done')