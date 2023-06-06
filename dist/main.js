"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const node_fetch_1 = __importDefault(require("node-fetch"));
async function generateCompletion(prompt, apiKey) {
    try {
        const response = await (0, node_fetch_1.default)("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "text-davinci-003",
                prompt,
                temperature: 1,
                max_tokens: 256,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI API responded with status ${response.status}`);
        }
        const responseData = await response.json();
        return responseData.choices[0].text.trim();
    }
    catch (error) {
        core.setFailed(`Error during completion generation: ${error.message}`);
    }
}
async function run() {
    try {
        const githubToken = core.getInput('github_token');
        const openaiApiKey = core.getInput('openai_api_key');
        const octokit = github.getOctokit(githubToken);
        const { owner, repo, number } = github.context.issue;
        const filesResponse = await octokit.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: number
        });
        const fileDescriptionsPromises = filesResponse.data.map(async (file) => {
            const fileContentResponse = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: file.filename,
                ref: 'refs/pull/' + number + '/head'
            });
            const fileContent = Buffer.from(fileContentResponse.data.content, 'base64').toString('utf8');
            const prDescription = await generateCompletion(fileContent, openaiApiKey);
            return `- ${file.filename}: ${prDescription}`;
        });
        const fileDescriptions = await Promise.all(fileDescriptionsPromises);
        const prDescription = fileDescriptions.join('\n');
        await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number: number,
            body: prDescription
        });
    }
    catch (error) {
        core.setFailed(`Action failed with error ${error}`);
    }
}
run();
