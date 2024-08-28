import {AparaviRetriever, getAuthToken} from "./retriever";

import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

// import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";

export const runtime = "edge";

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are a helpful assistant for a private company. All responses must be professional and as relevant as possible. Use the provided context to make your responses specific to the company and treat the provided context as accurate, real time information.

Context:
{context}

Current conversation:
{chat_history}

User: {input}
AI:`;

/**
 * This handler initializes and calls a simple chain with a prompt,
 * chat model, and output parser. See the docs for more information:
 *
 * https://js.langchain.com/docs/guides/expression_language/cookbook#prompttemplate--llm--outputparser
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    /**
     * Using Anthropic Model
     */
    const model = new ChatAnthropic({
      temperature: 0.8,
      model: "claude-3-5-sonnet-20240620",
    });

    /**
     * Chat models stream message chunks rather than bytes, so this
     * output parser handles serialization and byte-encoding.
     */
    const outputParser = new HttpResponseOutputParser();

    // Initialize custom Aparavi retrieve for RAG flow
    const auth_token = await getAuthToken()
    const retriever = new AparaviRetriever(auth_token,{})

    /**
     * Can also initialize as:
     *
     * const chain = prompt.pipe(model).pipe(outputParser);
     */    

    const ragChain = RunnableSequence.from([
      {
        chat_history: (x) => formattedPreviousMessages.join("\n"),
        input: new RunnablePassthrough(),
        context: retriever.pipe(formatDocumentsAsString)
      },
      prompt,
      model,
      outputParser
    ])

    const stream = await ragChain.stream(currentMessageContent);

    return new StreamingTextResponse(stream);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
