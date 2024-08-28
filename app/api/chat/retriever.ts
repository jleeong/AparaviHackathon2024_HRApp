import {
    BaseRetriever,
    type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Document, DocumentInterface } from "@langchain/core/documents";

export interface CustomRetrieverInput extends BaseRetrieverInput {}

export async function getAuthToken() {
    try {
        let token: string = ""
        const loginUrl = `http://${process.env.APARAVI_URL}:${process.env.APARAVI_PORT}/server/api/v3/login`
        const loginData = {
            userId: process.env.APARAVI_USER,
            password: process.env.APARAVI_PASS,
        }
        const headers = {"Content-Type": "application/json"}
        const response = await fetch(loginUrl, {
            method: "POST",
            body: JSON.stringify(loginData),
            headers: headers,
        })
            .then(res => res.json())
            .then(json => {
                token = json.data.token
            });
        return token
    } catch (e: any) {
        throw e
    }
}

export class AparaviRetriever extends BaseRetriever {
    lc_namespace = ["langchain", "retrievers"];
    token: string;

    constructor(auth_token:string, fields?: CustomRetrieverInput) {
        super(fields)
        this.token = auth_token
    }

    async _getRelevantDocuments(_query: string, _callbacks?: CallbackManagerForRetrieverRun): Promise<DocumentInterface<Record<string, any>>[]> {
        const documents:Array<Document> = [
            new Document({
                pageContent: "With more than 100 employees from 15 nations APARAVI develops, operates and sells its data intelligence & automation platform in Europe and the USA. APARAVI was founded by Adrian Knapp in the Swiss city of Zug, where the company’s headquarters are located. The company also has offices in Munich (Germany), Columbus, OH (USA), Santa Monica (USA).",
                metadata: {},
            })
        ];
        const searchUrl = `http://${process.env.APARAVI_URL}:${process.env.APARAVI_PORT}/server/api/v3/database/vectorSearch?`
        const searchParams = new URLSearchParams({
            search: _query,
            storePath: (process.env.APARAVI_STORE_PATH || ""),
            limit: (process.env.APARAVI_SEM_SEARCH_LIMIT || "5")
        });
        
        const searchHeaders = {"Authorization": this.token}

        await fetch(searchUrl+ new URLSearchParams(searchParams).toString(),{
            headers: searchHeaders
        })
        .then(res => res.json())
        .then(json => {
            for (const doc of json.data) {
                const { content, ...meta } = doc
                documents.push(new Document({
                    pageContent: content,
                    metadata: meta
                }))
            }
        });
        return documents;
    }
}